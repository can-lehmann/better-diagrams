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

// Better Diagrams

/*
 * Todo List:
 * - Private classes
 * - Constructors
 * - AssociativeRelation
 *   - Aggregation/Compositon
 *   - Number of Items
 *
 * Large Tasks:
 * - Preserve Doc Comments
 * - GraphQL Import
 * - TypeScript Import
 * - PlantUML Export
 * - Interactive positioning
 */

import path from "path"
import {writeFileSync, readFileSync, readdirSync} from "fs"
import {parse, BaseJavaCstVisitorWithDefaults} from "java-parser"

String.prototype.escapeHtml = function() {
  return this.split("<").join("&lt;").split(">").join("&gt;")
}

String.prototype.escapeGraphViz = function() {
  return "\"" + this + "\""
}

class BlockNode {
  constructor(sections) {
    this.sections = sections
  }
  
  get(index) { return this.sections[index] }
  add(section) { this.sections.push(section) }
  insert(index, section) { this.sections.splice(index, 0, section) }
  addSections(sections) { this.sections = [...this.sections, ...sections] }
  
  toHtmlTable() {
    const sections = this.sections.map(section => section.toHtmlTable())
    return `<table border="0" cellborder="1" cellspacing="0">${sections}</table>`
  }
}

class BlockSection {
  constructor(align, lines) {
    this.align = align
    this.lines = lines
  }
  
  addLine(line) {
    this.lines.push(line)
  }
  
  toHtmlTable() {
    const lines = this.lines
      .map(line => `<tr><td align="${this.align}">${line}</td></tr>`)
      .join("")
    const content = lines.length > 0 ? `<table border="0">${lines}</table>` : ""
    return `<tr>
      <td align="${this.align}">
        ${content}
      </td>
    </tr>`
  }
}

class View {
  constructor(objects, diagram) {
    this.objects = new Set(objects)
    this.showAdjacent = false
    this.diagram = diagram
  }
  
  withAdjacent() {
    this.showAdjacent = true
    return this
  }
  
  planRender() {
    let rendered = []
    for (const object of this.objects) {
      rendered = [...rendered, ...object.collectObjects()]
    }
    rendered = new Set(rendered)
    
    let adjacent = []
    let relations = []
    for (const relation of this.diagram.relations) {
      if (rendered.has(relation.a) && rendered.has(relation.b)) {
        relations.push(relation)
      } else if (this.showAdjacent && rendered.has(relation.a)) {
        relations.push(relation)
        adjacent.push(relation.b)
      }
    }
    
    return {objects: this.objects, adjacent, relations}
  }
  
  toGraphViz(dpi=72) {
    let output = "digraph {\n"
    output += "rankdir=BT;\n"
    output += `dpi=${dpi};` + "\n"
    
    const {objects, adjacent, relations} = this.planRender()
    
    for (const object of objects) {
      output += object.toGraphViz()
    }
    for (const object of adjacent) {
      output += object.toGraphViz(true)
    }
    
    for (const relation of relations) {
      output += relation.toGraphViz() + "\n"
    }
    
    output += "}\n"
    return output
  }
  
  saveGraphViz(filePath) {
    writeFileSync(filePath, this.toGraphViz())
  }
}

export class Diagram {
  constructor() {
    this.objects = new Map()
    this.relations = []
  }
  
  addObject(object) {
    if (this.objects.has(object.name)) {
      throw "Multiple objects with the same name"
    }
    this.objects.set(object.name, object)
  }
  
  hasObject(name) {
    return this.objects.has(name)
  }
  
  getObject(name) {
    return this.objects.get(name)
  }
  
  addRelation(relation) {
    this.relations.push(relation)
  }
  
  viewAll() {
    return new View(this.objects.values(), this)
  }
  
  view(object) {
    return new View([object], this)
  }
  
  
}

class DiagramObject {
  constructor(name) {
    this.name = name
    this.package = []
  }
  
  get stereotypes() { return [] }
  
  toBlockSections() {
    return []
  }
  
  collectObjects() {
    return new Set([this])
  }
  
  toGraphViz(isExternal=false) {
    const header = new BlockSection("center", [])
    if (this.stereotypes.length > 0) {
      header.addLine("«" + this.stereotypes.join(", ") + "»")
    }
    header.addLine(this.name)
    const block = new BlockNode([header])
    if (isExternal) {
      header.addLine(`(from ${this.package.join(".")})`)
    } else {
      block.addSections(this.toBlockSections())
    }
    
    const label = block.toHtmlTable()
    return `${this.name.escapeGraphViz()} [shape=none, label=<${label}>];\n`
  }
}

class ClassObject extends DiagramObject {
  constructor(name) {
    super(name)
    this.isAbstract = false
    this.attributes = []
    this.constructors = []
    this.methods = []
  }
  
  get stereotypes() {
    return this.isAbstract ? ["abstract"] : []
  }
  
  addAttribute(attribute) {
    this.attributes.push(attribute)
  }
  
  addMethod(method) {
    this.methods.push(method)
  }
  
  addConstructor(constr) {
    this.constructors.push(constr)
  }
  
  toBlockSections() {
    const attributes = this.attributes.map(attr => attr.toHtml())
    const methods = [...this.constructors, ...this.methods].map(method => method.toHtml())
    return [
      new BlockSection("left", attributes),
      new BlockSection("left", methods)
    ]
  }
}

class EnumObject extends ClassObject {
  constructor(name) {
    super(name)
    this.constants = []
  }
  
  get stereotypes() { return ["enumeration"] }
  
  addConstant(constant) {
    this.constants.push(constant)
  }
  
  toBlockSections() {
    const sections = super.toBlockSections()
    sections.splice(0, 0, new BlockSection("left", this.constants.map(constant => constant.escapeHtml())))
    return sections
  }
}

class InterfaceObject extends DiagramObject {
  constructor(name) {
    super(name)
    this.methods = []
  }
  
  get stereotypes() { return ["interface"] }
  
  addMethod(method) {
    this.methods.push(method)
  }
  
  toBlockSections() {
    const methods = this.methods.map(method => method.toHtml())
    return [new BlockSection("left", methods)]
  }
}

class UnresolvedObject extends DiagramObject {
  
}

class PackageObject extends DiagramObject {
  constructor(name) {
    super(name)
    this.objects = new Map()
  }
  
  addObject(object) {
    this.objects.set(object.name, object)
  }
  
  insert(path, object) {
    if (path.length == 0) {
      this.addObject(object)
    } else {
      const packageName = path[0]
      if (!this.objects.has(packageName)) {
        this.addObject(new PackageObject(packageName))
      }
      this.objects.get(packageName).insert(path.slice(1), object)
    }
  }
  
  get(path) {
    const object = this.objects.get(path[0])
    if (path.length == 1) {
      return object
    } else {
      return object.get(path.slice(1))
    }
  }
  
  collectObjects() {
    let objects = new Set([])
    for (const [name, object] of this.objects.entries()) {
      objects = new Set([...objects, ...object.collectObjects()])
    }
    return objects
  }
  
  toGraphViz(external=false) {
    const objects = []
    for (const [name, object] of this.objects.entries()) {
      objects.push(object.toGraphViz())
    }
    return `subgraph ${("cluster" + this.name).escapeGraphViz()} {
      color=black;
      label=${this.name.escapeGraphViz()};
      ${objects.join("\n")}
    };`
  }
}

class ClassMember {
  constructor(visibility, name) {
    this.visibility = visibility
    this.name = name
    this.isStatic = false
  }
  
  toHtml() {
    return ""
  }
}

class Attribute extends ClassMember {
  constructor(visibility, name, type) {
    super(visibility, name)
    this.type = type
  }
  
  toHtml() {
    let html = `${this.visibility} ${this.name}: ${this.type.escapeHtml()}`
    if (this.isStatic) {
      html = `<u>${html}</u>`
    }
    return html
  }
}

class Method extends ClassMember {
  constructor(visibility, name, args, result) {
    super(visibility, name)
    this.isAbstract = false
    this.args = args
    this.result = result
  }
  
  toHtml() {
    const args = this.args.map(arg => arg.toHtml()).join(", ")
    let html = `${this.visibility} ${this.name}(${args}): ${this.result.escapeHtml()}`
    if (this.isStatic) { html = `<u>${html}</u>` }
    if (this.isAbstract) { html = `<i>${html}</i>` }
    return html
  }
}

class Constructor extends ClassMember {
  constructor(visibility, name, args) {
    super(visibility, name)
    this.args = args
  }
  
  toHtml() {
    const args = this.args.map(arg => arg.toHtml()).join(", ")
    return `${this.visibility} «create» ${this.name}(${args})`
  }
}

class Argument {
  constructor(name, type) {
    this.name = name
    this.type = type
  }
  
  toHtml() {
    return this.name + ":  " + this.type.escapeHtml()
  }
}

class Relation {
  constructor(a, b) {
    this.a = a
    this.b = b
  }
  
  shouldRender(rendered) {
    return rendered.has(this.a)
  }
  
  resolve(lookup) {
    if (this.a instanceof UnresolvedObject) {
      this.a = lookup(this.a.name)
    }
    if (this.b instanceof UnresolvedObject) {
      this.b = lookup(this.b.name)
    }
  }
  
  toGraphViz() {
    return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()};`
  }
}

class InheritanceRelation extends Relation {
  toGraphViz() {
    return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [arrowhead=onormal, weight=10];`
  }
}

class ImplementsRelation extends Relation {
  toGraphViz() {
    return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [arrowhead=onormal, weight=10, style=dashed];`
  }
}

class AssociativeRelation extends Relation {
  constructor(a, b) {
    super(a, b)
    this.roleA = ""
    this.roleB = ""
    this.name = ""
  }
  
  toGraphViz() {
    return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [
      weight=1,
      label=${this.name.escapeGraphViz()},
      headlabel=${this.roleB.escapeGraphViz()},
      taillabel=${this.roleA.escapeGraphViz()}
    ];`
  }
}

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

function walkTree(basePath, func) {
  const entries = readdirSync(basePath, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(basePath, entry.name)
    if (entry.isDirectory()) {
      walkTree(entryPath, func)
    } else {
      func(entryPath)
    }
  }
}

// Diagram Passes
function resolveObjects(diagram) {
  for (const relation of diagram.relations) {
    relation.resolve(name => {
      if (!diagram.hasObject(name)) {
        console.warn(`Unable to resolve object ${name}`)
        return new UnresolvedObject(name)
      }
      return diagram.getObject(name)
    })
  }
}

function inferAssociations(diagram) {
  for (const [name, object] of diagram.objects.entries()) {
    if (object instanceof ClassObject) {
      for (const attribute of object.attributes) {
        const refs = attribute.type.split(/\>|\<|,/).filter(name => name != "")
        for (const ref of refs) {
          if (diagram.hasObject(ref)) {
            const relation = new AssociativeRelation(
              object,
              diagram.getObject(ref)
            )
            relation.roleB = attribute.name
            diagram.addRelation(relation)
          }
        }
      }
    }
  }
}

export function buildPackageTree(diagram) {
  let commonPrefix = null
  for (const [name, object] of diagram.objects.entries()) {
    if (commonPrefix == null) {
      commonPrefix = [...object.package]
      continue
    }
    let commonCount = 0
    while (commonCount < commonPrefix.length &&
           commonCount < object.package.length &&
           object.package[commonCount] == commonPrefix[commonCount]) {
      commonCount++
    }
    commonPrefix = commonPrefix.splice(0, commonCount)
  }
  
  const root = new PackageObject(commonPrefix.join("."))
  for (const [name, object] of diagram.objects.entries()) {
    root.insert(object.package.slice(commonPrefix.length), object)
  }
  return root
}

Diagram.fromJavaProject = function(basePath) {
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
  inferAssociations(diagram)
  
  return diagram
}


