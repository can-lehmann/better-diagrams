/*
 * Copyright 2022 Can Joshua Lehmann & Oliver Enes
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
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
import {
  DiagramObject,
  ClassObject, EnumObject, InterfaceObject,
  ClassMember, Attribute, Method, Constructor, Argument,
  DocComment, ImplementsRelation, InheritanceRelation
} from "./../model.mjs"


/*
*   === LaTex Helper
*/

function text(...strings) {
  strings = strings.map((string) => string.toString())
  return strings.join("")
}

function textbf(...text) {
  text = text.map((text) => text.toString())
  return `\\textbf{${text.join("")}}`
}

function texttt(...text) {
  text = text.map((text) => text.toString())
  return `\\texttt{${text.join("")}}`
}

function subsection(title, starred = false, tocTitle = null) {
  const cmd = starred ? "\\subsection*" : "\\subsection"
  if (tocTitle) {
    return `${cmd}[${tocTitle}]{${title}}`
  }
  return `${cmd}{${title}}`
}

function subsectionmark(mark) {
  return `\\subsectionmark{${mark}}`
}

function ref(ref) {
  return `\\ref{${ref}}`
}

function itemize(items, options = "") {
  if (!items || !items.length) {
    return ""
  }

  return text(
    `\\begin{itemize}[${options}]\n`,
    items.map(item => `\\item ${item}\n`).join(""),
    `\\end{itemize}\n`
  )
}

function enumerate(items, options = "") {
  if (!items || !items.length) {
    return ""
  }

  return text(
    `\\begin{enumerate}[${options}]\n`,
    items.map((item) => `\\item ${item}\n`).join(""),
    `\\end{enumerate}\n`
  )
}

// ====

String.prototype.encodeLaTeX = function() {
  return this.split("_").join("\\_")
}

ClassMember.prototype.toLaTeX = function() {
  return texttt(
    textbf(
      this.name.encodeLaTeX()
    )
  )
}

DocComment.prototype.toLaTeX = function() {
  return text(
    this.content.encodeLaTeX(),
    "\n",
    itemize(
      this.attrs
        .filter((attr) => attr.name === "@param")
        .map((attr) => `${texttt(attr.params[0])}: ${attr.value}`),
      "label="
    )
  )
}

Attribute.prototype.toLaTeX = function() {
  const lines = [texttt(textbf(
    `${this.visibility} ${this.stereotypePrefix}${this.name}: ${this.type.toString()}`
  ))]
  if (this.doc.content.length > 0) {
    lines.push("\\\\")
    lines.push(this.doc.toLaTeX())
  }
  
  return text(...lines)
}

Argument.prototype.toLaTeX = function() {
  return `${this.name}: ${this.type.toString()}`
}

Method.prototype.toLaTeX = function() {
  const args = this.args.map(arg => arg.toLaTeX())
  const prefix = `${this.visibility} ${this.stereotypePrefix}`
  const signature = `${this.name}(${args.join(", ")}): ${this.result.toString()}`
  
  const lines = [texttt(textbf(prefix + signature))]
  if (this.doc.content.length > 0) {
    lines.push("\\\\")
    lines.push(this.doc.toLaTeX())
  }
  
  return text(...lines)
}

Constructor.prototype.toLaTeX = function() {
  const args = this.args.map(arg => arg.toLaTeX())
  
  const lines = [texttt(textbf(`${this.visibility} ${this.stereotypePrefix}${this.name}(${args.join(", ")})`))]
  if (this.doc.content.length > 0) {
    lines.push("\\\\")
    lines.push(this.doc.toLaTeX())
  }  

  return text(...lines)
}


function membersToLaTeX(name, members) {
  if (!members || !members.length) {
    return ""
  }

  return subsectionmark(name)
    + "\n"
    +  subsection(name, true)
    + "\n"
    + itemize(members.map((member) => ` ${member.toLaTeX()}`), "label=,leftmargin=0pt")
    + "\n"
}

DiagramObject.prototype.toLaTeX = function(config) {
  const packageName = this.package.removeCommonPrefix(config.packagePrefix).join(".")

  return  subsectionmark(this.name)
    + "\n"
    + subsection(
      text(
        texttt(textbf(this.name)),
        "\\hfill",
        texttt(textbf(
          config.useFaIcons ? `\\faIcon{folder} ${packageName}` : packageName
        )),
        `\n`
      ), false, this.name
    )
    + "\n"
    + `${this.doc.toLaTeX()}`
    + "\n"
}

ClassObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX(config.translations.attributes, this.attributes)
  section += membersToLaTeX(config.translations.methods, [...this.constructors, ...this.methods])

  // inheritance
  const inheritanceRelations = []
  const implementsRelations = []
  for (const relation of config.relations.get(this) ||  []) {
    if (relation instanceof InheritanceRelation) {
      inheritanceRelations.push(relation)
    } else if (relation instanceof ImplementsRelation) {
      implementsRelations.push(relation)
    }
  }

  if (inheritanceRelations && inheritanceRelations.length) {
    section += textbf(`${config.translations.extends}: `) + inheritanceRelations.map((relation) => texttt(ref(relation.b.name))).join(", ") + "\\\\"
  }

  if (implementsRelations && implementsRelations.length) {
    section += textbf(`${config.translations.implements}: `) + implementsRelations.map((relation) => texttt(ref(relation.b.name))).join(", ") + "\\\\"
  }

  return section
}

InterfaceObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX(config.translations.methods, this.methods)

  const relations = config.relations.get(this) || []

  if (relations && relations.length) {
    section += textbf(`${config.translations.extends}: `) + relations.map((relation) => texttt(ref(relation.name))).join(", ") + "\n"
  }

  return section
}

EnumObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX(config.translations.constants, this.constants)
  section += membersToLaTeX(config.translations.attributes, this.attributes)
  section += membersToLaTeX(config.translations.methods, this.methods)

  return section
}

const DEFAULT_CONFIG = {
  packagePrefix: [],
  useFaIcons: false,
  translations: {
    constants: "Constants",
    attributes: "Attributes",
    methods: "Methods",
    extends: "Extends ",
    implements: "Implements "
  }
}

View.prototype.toLaTeX = function(partialConfig) {
  // setup relation mappings
  const relations = new Map()
  for (const relation of this.diagram.relations) {
    const oldMapping = relations.get(relation.a) || []
    relations.set(relation.a, oldMapping.concat([relation.b]))
  }

  const config = Object.assign({...DEFAULT_CONFIG, relations}, partialConfig || {})

  let result = ""

  const objects = [...this.objects]
  objects.sort((a, b) => {
    for (let it = 0; it < a.package.length && it < b.package.length; it++) {
      const order = a.package[it].localeCompare(b.package[it])
      if (order != 0) {
        return order
      }
    }
    if (a.package.length == b.package.length) {
      return a.name.localeCompare(b.name)
    } else {
      return a.package.length - b.package.length
    }
  })

  for (const object of objects) {
    result += object.toLaTeX(config) + "\n"
  }

  return result
}

View.prototype.saveLaTeX = function(filePath, partialConfig) {
  writeFileSync(filePath, this.toLaTeX(partialConfig))
}

