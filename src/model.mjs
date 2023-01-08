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
  
  fuse(other) {
    for (const [name, object] of other.objects) {
      if (this.hasObject(name)) {
        this.getObject(name).fuse(object)
      } else {
        this.addObject(object)
      }
    }
    
    for (const relation of other.relations) {
      this.addRelation(relation)
    }
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
    this.doc = new DocComment()
    this.customStereotypes = []
    this.generics = []
  }
  
  addGeneric(genericType) {
    this.generics.push(genericType)
  }
  
  get stereotypes() { return [...this.customStereotypes] }
  get modifiers() { return ["public"] }
  
  get nameWithGenerics() {
    let name = this.name
    if (this.generics.length > 0) {
      name += `<${this.generics.map(type => type.toString()).join(", ")}>`
    }
    return name
  }
  
  fuse(other) {
  }
  
  toBlockSections() {
    return []
  }
  
  collectObjects() {
    return new Set([this])
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
    const stereotypes = super.stereotypes
    if (this.isAbstract) { stereotypes.push("abstract") }
    return stereotypes
  }
  
  get modifiers() {
    const modifiers = super.modifiers
    if (this.isAbstract) { modifiers.push("abstract") }
    return modifiers
  }
  
  fuse(other) {
    super.fuse(other)
    this.attributes = [...this.attributes, ...other.attributes]
    this.constructors = [...this.constructors, ...other.constructors]
    this.methods = [...this.methods, ...other.methods]
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
  
  get stereotypes() { return ["enumeration", ...super.stereotypes] }
  
  fuse(other) {
    super.fuse(other)
    this.constants = [...this.constants, ...other.constants]
  }
  
  addConstant(constant) {
    this.constants.push(constant)
  }
  
  toBlockSections() {
    const sections = super.toBlockSections()
    sections.splice(0, 0, new BlockSection("left", this.constants.map(constant => constant.name.escapeHtml())))
    return sections
  }
}

export class InterfaceObject extends DiagramObject {
  constructor(name) {
    super(name)
    this.methods = []
  }
  
  get stereotypes() { return ["interface", ...super.stereotypes] }
  
  fuse(other) {
    super.fuse(other)
    this.methods = [...this.methods, other.methods]
  }
  
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
}

export class ClassMember {
  constructor(visibility, name) {
    this.visibility = visibility
    this.name = name
    this.isStatic = false
    this.customStereotypes = []
    this.doc = new DocComment()
  }
  
  get stereotypes() {
    return [...this.customStereotypes]
  }
  
  get modifiers() {
    const modifiers = []
    switch (this.visibility) {
      case "+": modifiers.push("public"); break
      case "-": modifiers.push("private"); break
      case "#": modifiers.push("protected"); break
    }
    if (this.isStatic) { modifiers.push("static") }
    return modifiers
  }
  
  get stereotypePrefix() {
    if (this.stereotypes.length > 0) {
      return `«${this.stereotypes.join(", ")}» `
    } else {
      return ""
    }
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
    let html = `${this.visibility} ${this.stereotypePrefix}${this.name}: ${this.type.toString().escapeHtml()}`
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
  
  get modifiers() {
    const modifiers = super.modifiers
    if (this.isAbstract) {
      modifiers.push("abstract")
    }
    return modifiers
  }
  
  toHtml() {
    const args = this.args.map(arg => arg.toHtml()).join(", ")
    let html = `${this.visibility} ${this.stereotypePrefix}${this.name}(${args}): ${this.result.toString().escapeHtml()}`
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
  
  get stereotypes() {
    return ["create", ...super.stereotypes]
  }
  
  toHtml() {
    const args = this.args.map(arg => arg.toHtml()).join(", ")
    return `${this.visibility} ${this.stereotypePrefix}${this.name}(${args})`
  }
}

export class Argument {
  constructor(name, type) {
    this.name = name
    this.type = type
  }
  
  toHtml() {
    return this.name + ":  " + this.type.toString().escapeHtml()
  }
}

export class Constant extends ClassMember {
  constructor(name) {
    super("", name)
  }
}

export class Relation {
  constructor(a, b) {
    this.a = a
    this.b = b
    this.visual = {}
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
}

export class InheritanceRelation extends Relation {
  
}

export class ImplementsRelation extends Relation {
  
}

export class AssociativeRelation extends Relation {
  constructor(a, b) {
    super(a, b)
    this.name = ""
    this.roleA = ""
    this.roleB = ""
    this.headA = ""
    this.headB = ">"
    this.multiplicityA = ""
    this.multiplicityB = ""
  }
}

export class DocComment {
  constructor(content) {
    this.content = content || ""
    this.attrs = []
  }
  
  addAttribute(name, params, value) {
    this.attrs.push({name, params, value})
  }
  
  findAttribute(name) {
    return this.attrs.find(attr => name == attr.name) || null
  }
}

