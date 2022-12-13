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
import {writeFileSync, mkdirSync} from "fs"
import {View} from "./../rendering.mjs"
import {BlockSection, BlockNode} from "./../utils.mjs"
import {
  Diagram, DiagramObject, Relation, ClassMember,
  ClassObject, EnumObject, InterfaceObject, UnresolvedObject, PackageObject,
  Attribute, Method, Constructor, Argument, Constant,
  InheritanceRelation, ImplementsRelation, AssociativeRelation
} from "./../model.mjs"

const INDENT = "    "

ClassMember.prototype.toJava = function(indent) {
  const modifiers = this.modifiers.map(mod => mod + " ").join("")
  return `${indent}${modifiers}${this.toJavaDecl(indent)}`
}

Attribute.prototype.toJavaDecl = function(indent) {
  return `${this.type} ${this.name};`
}

Argument.prototype.toJava = function() {
  return `${this.type} ${this.name}`
}

Method.prototype.toJavaDecl = function(indent) {
  const args = this.args.map(arg => arg.toJava()).join(", ")
  return `${this.result} ${this.name}(${args}) {\n${indent}}`
}

Constructor.prototype.toJavaDecl = function(indent) {
  const args = this.args.map(arg => arg.toJava()).join(", ")
  return `${this.name}(${args}) {\n${indent}}`
}

Constant.prototype.toJavaDecl = function(indent) {
  return `${this.name}`
}

DiagramObject.prototype.toJava = function(indent) {
  console.log(this)
  const modifiers = this.modifiers.map(mod => mod + " ").join("")
  return `package ${this.package.join(".")};\n\n` +
         `${indent}${modifiers}${this.toJavaDecl(indent)}`
}

ClassObject.prototype.toJavaDecl = function(indent) {
  const attrs = this.attributes
    .map(attr => attr.toJava(indent + INDENT))
    .join("\n")
  const methods = [...this.constructors, ...this.methods]
    .map(method => method.toJava(indent + INDENT))
    .join("\n\n")
  return `class ${this.name} {\n${attrs}\n\n${methods}\n}`
}

EnumObject.prototype.toJavaDecl = function(indent) {
  let constants = this.constants
    .map(constant => constant.toJava(indent + INDENT))
    .join(",\n")
  if (this.attributes.length > 0 ||
      this.constructors.length > 0 ||
      this.methods.length > 0) {
    constants += ";"
    const attrs = this.attributes
      .map(attr => attr.toJava(indent + INDENT))
      .join("\n")
    const methods = [...this.constructors, ...this.methods]
      .map(method => method.toJava(indent + INDENT))
      .join("\n\n")
    
    return `enum ${this.name} {\n${constants}\n${attrs}\n\n${methods}\n}`
  } else {
    return `enum ${this.name} {\n${constants}\n}`
  }
  
}

InterfaceObject.prototype.toJavaDecl = function(indent) {
  const methods = this.methods
    .map(method => indent + method.toJavaDecl(indent + INDENT))
    .join("\n\n")
  return `interface ${this.name} {\n${methods};\n}`
}

View.prototype.saveJavaProject = function(basePath) {
  for (const object of this.objects) {
    const packageDir = path.join(basePath, ...object.package)
    mkdirSync(packageDir, {recursive: true})
    const objectPath = path.join(packageDir, `${object.name}.java`)
    writeFileSync(objectPath, object.toJava(""))
  }
}

