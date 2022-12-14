/*
 * Copyright 2022 Can Joshua Lehmann
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http:/www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from "path"
import {readFileSync} from "fs"
import {parse, BaseJavaCstVisitorWithDefaults} from "java-parser"
import {walkTree} from "./../utils.mjs"
import {resolveObjects, inferAssociations} from "./../passes.mjs"
import {
  Diagram,
  ClassObject, EnumObject, InterfaceObject, UnresolvedObject, PackageObject,
  Attribute, Method, Constructor, Argument, Constant,
  InheritanceRelation, ImplementsRelation, AssociativeRelation,
  DocComment
} from "./../model.mjs"
import {
  Type, CollectionType, NamedType, VoidType, ListType, SetType, SourceType
} from "./../types.mjs"

class Visitor extends BaseJavaCstVisitorWithDefaults {
  constructor(source, diagram, config) {
    super()
    this.source = source
    this.diagram = diagram
    this.config = config
    this.package = null
  }
  
  hasModifier(modifiers, modifier) {
    return modifiers.some(mod => mod.children.hasOwnProperty(modifier))
  }
  
  getVisibility(modifiers) {
    if (this.hasModifier(modifiers, "Public")) {
      return "+"
    } else if (this.hasModifier(modifiers, "Private")) {
      return "-"
    } else if (this.hasModifier(modifiers, "Protected")) {
      return "#"
    }
    return "~"
  }
  
  extractFromSource(node) {
    return this.source.substring(node.location.startOffset, node.location.endOffset + 1)
  }
  
  parseType(node) {
    return new SourceType(this.extractFromSource(node))
  }
  
  parseAttributes(fieldDeclaration) {
    const type = this.parseType(fieldDeclaration.children.unannType[0])
    
    const modifiers = fieldDeclaration.children.fieldModifier || []
    const visibility = this.getVisibility(modifiers)
    const customStereotypes = this.parseCustomStereotypes(modifiers)
    
    const decls = fieldDeclaration.children.variableDeclaratorList[0].children.variableDeclarator
    return decls.map(decl => {
      const name = decl.children.variableDeclaratorId[0].children.Identifier[0].image
      
      const attr = new Attribute(visibility, name, type.clone())
      attr.isStatic = this.hasModifier(modifiers, "Static")
      attr.customStereotypes = [...customStereotypes]
      return attr
    })
  }
  
  parseArguments(formalParameterList) {
    const args = []
    if (formalParameterList) {
      for (const param of formalParameterList[0].children.formalParameter) {
        const paramDecl = param.children.variableParaRegularParameter[0]
        
        const type = this.parseType(paramDecl.children.unannType[0])
        const name = paramDecl.children.variableDeclaratorId[0].children.Identifier[0].image
        args.push(new Argument(name, type))
      }
    }
    return args
  }
  
  parseMethod(methodDeclaration) {
    const header = methodDeclaration.children.methodHeader[0]
    const decl = header.children.methodDeclarator[0]
    const modifiers = methodDeclaration.children.methodModifier ||
                      methodDeclaration.children.interfaceMethodModifier || []
    
    const name = decl.children.Identifier[0].image
    const args = this.parseArguments(decl.children.formalParameterList)
    let result = new VoidType()
    if (header.children.result[0].children.unannType) {
      result = this.parseType(header.children.result[0].children.unannType[0])
    }
    const visibility = this.getVisibility(modifiers)
    
    const method = new Method(visibility, name, args, result)
    method.isStatic = this.hasModifier(modifiers, "Static")
    method.isAbstract = this.hasModifier(modifiers, "Abstract")
    method.customStereotypes = this.parseCustomStereotypes(modifiers)
    return method
  }
  
  parseClassBody(body, object) {
    for (const node of body) {
      const kind = Object.keys(node.children)[0]
      const child = node.children[kind][0]
      
      switch (kind) {
        case "classMemberDeclaration":
          if (child.children.hasOwnProperty("fieldDeclaration")) {
            const fieldDeclaration = child.children.fieldDeclaration[0]
            this.parseAttributes(fieldDeclaration).forEach(attr => {
              attr.doc = this.parseDocComment(child)
              object.addAttribute(attr)
            })
          } else if (child.children.hasOwnProperty("methodDeclaration")) {
            const methodDeclaration = child.children.methodDeclaration[0]
            const method = this.parseMethod(methodDeclaration)
            method.doc = this.parseDocComment(child)
            object.addMethod(method)
          }
        break
        case "constructorDeclaration":
          const decl = child.children.constructorDeclarator[0]
          
          const visibility = this.getVisibility(child.children.constructorModifier || [])
          const name = decl.children.simpleTypeName[0].children.Identifier[0].image
          const args = this.parseArguments(decl.children.formalParameterList)
          const constr = new Constructor(visibility, name, args)
          constr.doc = this.parseDocComment(child)
          object.addConstructor(constr)
        break
      }
      
    }
  }
  
  extractDocComment(node) {
    let cur = node.location.startOffset - 1
    while (cur >= 0 && "\n\t\r ".includes(this.source.charAt(cur))) {
      cur--
    }
    
    if (cur <= 2 || this.source.substr(cur - 1, 2) != "*/") {
      return ""
    }
    const end = cur + 1
    while (cur >= 0 && this.source.substr(cur, 2) != "/*") {
      cur--
    }
    return this.source.substring(cur, end)
  }
  
  parseDocComment(node) {
    const comment = this.extractDocComment(node)
    const lines = comment.split("\n").map(line => line.trim())
    if (lines[0] != "/**") {
      return new DocComment("")
    }
    
    const doc = new DocComment("")
    
    const content = []
    let isValid = true
    for (let line of lines.slice(1)) {
      if (line == "*/") { continue }
      if (!line.startsWith("*")) {
        isValid = false
        break
      }
      line = line.substr(1).trim()
      if (line.startsWith("@")) {
        const [name, rest] = line.splitOne(" ")
        switch(name) {
          case "@param":
          case "@throws":
            const [param, description] = rest.splitOne(" ")
            doc.addAttribute(name, [param], description)
          break
          case "@assoc":
            doc.addAttribute(name, rest.split(" "), "")
          break
          default: doc.addAttribute(name, [], rest)
        }
      } else {
        content.push(line)
      }
    }
    
    if (isValid) {
      doc.content = content.join("\n")
      return doc
    } else {
      throw "Invalid doc comment"
    }
  }
  
  parseCustomStereotypes(modifiers) {
    return modifiers
      .map(modifier => {
        const annotation = modifier.children.annotation
        if (annotation) {
          const name = annotation[0].children.typeName[0].children.Identifier[0].image
          console.log(name)
          if (this.config.customStereotypes.has(name)) {
            return this.config.customStereotypes.get(name)
          }
        }
        return null
      })
      .filter(stereotype => stereotype != null)
  }
  
  // Nodes
  packageDeclaration(ctx) {
    this.package = ctx.Identifier.map(ident => ident.image)
  }
  
  classDeclaration(ctx) {
    if (this.hasModifier(ctx.classModifier || [], "Public")) {
      if (ctx.enumDeclaration) {
        const decl = ctx.enumDeclaration[0].children
        const name = decl.typeIdentifier[0].children.Identifier[0].image
        
        
        const object = new EnumObject(name)
        
        const constantList = decl.enumBody[0].children.enumConstantList
        if (constantList) {
          const constants = constantList[0].children.enumConstant
          for (const constant of constants) {
            const member = new Constant(constant.children.Identifier[0].image)
            member.doc = this.parseDocComment(constant)
            object.addConstant(member)
          }
        }
        
        const body = decl.enumBody[0].children.enumBodyDeclarations
        if (body) {
          this.parseClassBody(body[0].children.classBodyDeclaration || [], object)
        }
        
        object.package = this.package
        object.doc = this.parseDocComment((ctx.classModifier || ctx.enumDeclaration)[0])
        this.diagram.addObject(object)
        
        return
      }
      const decl = ctx.normalClassDeclaration[0].children
      const name = decl.typeIdentifier[0].children.Identifier[0].image
      const body = decl.classBody[0].children.classBodyDeclaration
      
      const object = new ClassObject(name)
      object.isAbstract = this.hasModifier(ctx.classModifier, "Abstract")
      this.parseClassBody(body || [], object)
      
      object.package = this.package
      object.doc = this.parseDocComment((ctx.classModifier || ctx.normalClassDeclaration)[0])
      object.customStereotypes = this.parseCustomStereotypes(ctx.classModifier || [])
      this.diagram.addObject(object)
      
      if (decl.superclass) {
        const type = decl.superclass[0].children.classType[0]
        const typeName = type.children.Identifier[0].image
        this.diagram.addRelation(new InheritanceRelation(
          object,
          new UnresolvedObject(typeName)
        ))
      }
      
      if (decl.superinterfaces) {
        const types = decl.superinterfaces[0].children.interfaceTypeList[0].children.interfaceType
        for (const type of types) {
          const typeName = type.children.classType[0].children.Identifier[0].image
          this.diagram.addRelation(new ImplementsRelation(
            object,
            new UnresolvedObject(typeName)
          ))
        }
      }
    }
  }
  
  interfaceDeclaration(ctx) {
    if (this.hasModifier(ctx.interfaceModifier || [], "Public")) {
      const decl = ctx.normalInterfaceDeclaration[0].children
      const name = decl.typeIdentifier[0].children.Identifier[0].image
      
      const object = new InterfaceObject(name)
      for (const node of decl.interfaceBody[0].children.interfaceMemberDeclaration || []) {
        const kind = Object.keys(node.children)[0]
        const child = node.children[kind][0]
        
        switch (kind) {
          case "interfaceMethodDeclaration":
            const method = this.parseMethod(child)
            if (method.visibility == "~") {
              method.visibility = "+"
            }
            object.addMethod(method)
          break
        }
      }
      
      object.package = this.package
      object.doc = this.parseDocComment((ctx.interfaceModifier || ctx.interfaceBody)[0])
      this.diagram.addObject(object)
      
      if (decl.extendsInterfaces) {
        const base = decl.extendsInterfaces[0].children.interfaceTypeList[0].children.interfaceType
        base.forEach(type => {
          const name = type.children.classType[0].children.Identifier[0].image
          this.diagram.addRelation(new InheritanceRelation(
            object,
            new UnresolvedObject(name)
          ))
        })
      }
    }
  }
}

const DEFAULT_CONFIG = {
  associations: true,
  customStereotypes: new Map()
}

Diagram.fromJavaProject = function(basePath, partialConfig) {
  const config = Object.assign({...DEFAULT_CONFIG}, partialConfig || {})
  
  const diagram = new Diagram()
  walkTree(basePath, filePath => {
    if (path.parse(filePath).ext == ".java") {
      const code = readFileSync(filePath).toString()
      const tree = parse(code)
      const visitor = new Visitor(code, diagram, config)
      visitor.visit(tree)
    }
  })
  
  resolveObjects(diagram)
  
  if (config.associations) {
    inferAssociations(diagram)
  }
  
  return diagram
}


