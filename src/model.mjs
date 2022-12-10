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

import {View} from "./rendering.mjs"
import {BlockNode, BlockSection} from "./utils.mjs"

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

export class DiagramObject {
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

export class ClassObject extends DiagramObject {
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

export class EnumObject extends ClassObject {
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

export class InterfaceObject extends DiagramObject {
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

export class UnresolvedObject extends DiagramObject {
  
}

export class PackageObject extends DiagramObject {
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

export class ClassMember {
  constructor(visibility, name) {
    this.visibility = visibility
    this.name = name
    this.isStatic = false
  }
  
  toHtml() {
    return ""
  }
}

export class Attribute extends ClassMember {
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

export class Method extends ClassMember {
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

export class Constructor extends ClassMember {
  constructor(visibility, name, args) {
    super(visibility, name)
    this.args = args
  }
  
  toHtml() {
    const args = this.args.map(arg => arg.toHtml()).join(", ")
    return `${this.visibility} «create» ${this.name}(${args})`
  }
}

export class Argument {
  constructor(name, type) {
    this.name = name
    this.type = type
  }
  
  toHtml() {
    return this.name + ":  " + this.type.escapeHtml()
  }
}

export class Relation {
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

export class InheritanceRelation extends Relation {
  toGraphViz() {
    return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [arrowhead=onormal, weight=10];`
  }
}

export class ImplementsRelation extends Relation {
  toGraphViz() {
    return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [arrowhead=onormal, weight=10, style=dashed];`
  }
}

export class AssociativeRelation extends Relation {
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

