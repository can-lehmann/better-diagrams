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

import {writeFileSync} from "fs"
import {View} from "./../rendering.mjs"
import {BlockSection, BlockNode} from "./../utils.mjs"
import {
  Diagram, DiagramObject, Relation,
  ClassObject, EnumObject, InterfaceObject, UnresolvedObject, PackageObject,
  ClassMember, Attribute, Method, Constructor, Argument,
  InheritanceRelation, ImplementsRelation, AssociativeRelation
} from "./../model.mjs"

String.prototype.encodeLaTeX = function() {
  return this.split("_").join("\\_")
}

ClassMember.prototype.toLaTeX = function() {
  return `\\texttt{${this.name.encodeLaTeX()}}`
}

Attribute.prototype.toLaTeX = function() {
  return `\\texttt{${this.visibility} ${this.name}: ${this.type}}`
}

Argument.prototype.toLaTeX = function() {
  return `${this.name}: ${this.type}`
}

Method.prototype.toLaTeX = function() {
  const args = this.args.map(arg => arg.toLaTeX())
  return `\\texttt{${this.visibility} ${this.name}(${args.join(", ")}): ${this.result}}`
}

Constructor.prototype.toLaTeX = function() {
  const args = this.args.map(arg => arg.toLaTeX())
  return `\\texttt{${this.visibility} «create» ${this.name}(${args.join(", ")})}`
}

function membersToLaTeX(name, members) {
  if (members.length == 0) {
    return ""
  }
  let section = `\\subsection*{${name}}\n`
  section += "\\begin{enumerate}\n"
  for (const member of members) {
    section += `  \\item ${member.toLaTeX()}\n`
  }
  section += "\\end{enumerate}\n"
  return section
}

DiagramObject.prototype.toLaTeX = function(config) {
  const packageName = this.package.removeCommonPrefix(config.packagePrefix).join(".")
  return `\\subsection{${this.name}\\hfill\\texttt{${packageName}}}\n`
}

ClassObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX("Attributes", this.attributes)
  section += membersToLaTeX("Methods", this.methods)
  return section
}

InterfaceObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX("Methods", this.methods)
  return section
}

EnumObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX("Constants", this.constants)
  section += membersToLaTeX("Attributes", this.attributes)
  section += membersToLaTeX("Methods", this.methods)
  return section
}

const DEFAULT_CONFIG = {packagePrefix: []}

View.prototype.toLaTeX = function(partialConfig) {
  const config = Object.assign({...DEFAULT_CONFIG}, partialConfig || {})
  
  let result = ""
  const objects = [...this.objects]
  objects.sort((a, b) => {
    for (let it = 0; it < a.package.length && it < b.package.length; it++) {
      const order = a.package[it].localeCompare(b.package[it])
      if (order != 0) {
        return order
      }
    }
    return a.name.localeCompare(b.name)
  })
  for (const object of objects) {
    result += object.toLaTeX(config) + "\n"
  }
  return result
}

View.prototype.saveLaTeX = function(filePath, partialConfig) {
  writeFileSync(filePath, this.toLaTeX(partialConfig))
}

