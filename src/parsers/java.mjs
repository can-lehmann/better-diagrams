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
  Attribute, Method, Constructor, Argument,
  InheritanceRelation, ImplementsRelation, AssociativeRelation
} from "./../model.mjs"

class Visitor extends BaseJavaCstVisitorWithDefaults {
  constructor(source, diagram) {
    super()
    this.source = source
    this.diagram = diagram
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
  
  parseAttributes(fieldDeclaration) {
    const type = fieldDeclaration.children.unannType[0]
    const typeName = this.extractFromSource(type)
    
    const modifiers = fieldDeclaration.children.fieldModifier || []
    const visibility = this.getVisibility(modifiers)
    
    const decls = fieldDeclaration.children.variableDeclaratorList[0].children.variableDeclarator
    return decls.map(decl => {
      const name = decl.children.variableDeclaratorId[0].children.Identifier[0].image
      
      const attr = new Attribute(visibility, name, typeName)
      attr.isStatic = this.hasModifier(modifiers, "Static")
      return attr
    })
  }
  
  parseArguments(formalParameterList) {
    const args = []
    if (formalParameterList) {
      for (const param of formalParameterList[0].children.formalParameter) {
        const paramDecl = param.children.variableParaRegularParameter[0]
        
        const typeName = this.extractFromSource(paramDecl.children.unannType[0])
        const name = paramDecl.children.variableDeclaratorId[0].children.Identifier[0].image
        args.push(new Argument(name, typeName))
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
    let result = "void"
    if (header.children.result[0].children.unannType) {
      result = this.extractFromSource(header.children.result[0].children.unannType[0])
    }
    const visibility = this.getVisibility(modifiers)
    
    const method = new Method(visibility, name, args, result)
    method.isStatic = this.hasModifier(modifiers, "Static")
    method.isAbstract = this.hasModifier(modifiers, "Abstract")
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
              object.addAttribute(attr)
            })
          } else if (child.children.hasOwnProperty("methodDeclaration")) {
            const methodDeclaration = child.children.methodDeclaration[0]
            object.addMethod(this.parseMethod(methodDeclaration))
          }
        break
        case "constructorDeclaration":
          const decl = child.children.constructorDeclarator[0]
          
          const visibility = this.getVisibility(child.children.constructorModifier || [])
          const name = decl.children.simpleTypeName[0].children.Identifier[0].image
          const args = this.parseArguments(decl.children.formalParameterList)
          
          object.addConstructor(new Constructor(visibility, name, args))
        break
      }
      
    }
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
            object.addConstant(constant.children.Identifier[0].image)
          }
        }
        
        const body = decl.enumBody[0].children.enumBodyDeclarations
        if (body) {
          this.parseClassBody(body[0].children.classBodyDeclaration || [], object)
        }
        
        object.package = this.package
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

const DEFAULT_CONFIG = {associations: true}

Diagram.fromJavaProject = function(basePath, partialConfig) {
  const diagram = new Diagram()
  walkTree(basePath, filePath => {
    if (path.parse(filePath).ext == ".java") {
      const code = readFileSync(filePath).toString()
      const tree = parse(code)
      const visitor = new Visitor(code, diagram)
      visitor.visit(tree)
    }
  })
  
  resolveObjects(diagram)
  
  const config = Object.assign({...DEFAULT_CONFIG}, partialConfig || {})
  if (config.associations) {
    inferAssociations(diagram)
  }
  
  return diagram
}


