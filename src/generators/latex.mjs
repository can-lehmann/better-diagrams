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
  ClassMember, Constant, Attribute, Method, Constructor, Argument,
  DocComment, ImplementsRelation, InheritanceRelation,
  UnresolvedObject
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

function subsubsection(title, starred = false, tocTitle = null) {
  let command = "\\subsubsection"
  if (starred) {
    command += "*"
  }
  if (tocTitle) {
    return `${command}[${tocTitle}]{${title}}`
  }
  return `${command}{${title}}`
}

function subsubsectionmark(mark) {
  return `\\subsubsectionmark{${mark}}`
}

function ref(ref) {
  return `\\ref{${ref}}`
}

function nameref(ref) {
  return `\\nameref{${ref}}`
}

function label(name) {
  return `\\label{${name}}`
}

function index(text, indexName = null) {
  if (indexName) {
    return `\\index[${indexName}]{${text}}`;
  }

  return `\\index{${text}}`;
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
  return this
    .split("_").join("\\_")
    .split("#").join("\\#")
}

ClassMember.prototype.toLaTeX = function() {
  return texttt(this.name.encodeLaTeX())
}

Constant.prototype.toLaTeX = function() {
  const lines = [texttt(this.name.encodeLaTeX())]
  if (this.doc.content.length > 0) {
    lines.push("\\\\")
    lines.push(this.doc.toLaTeX())
  }
  
  return text(...lines)
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
  const lines = [texttt(
    `${this.visibility} ${this.stereotypePrefix}${this.name}: ${this.type.toString()}`.encodeLaTeX()
  )]
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
  
  const lines = [texttt((prefix + signature).encodeLaTeX())]
  if (this.doc.content.length > 0) {
    lines.push("\\\\")
    lines.push(this.doc.toLaTeX())
  }
  
  return text(...lines)
}

Constructor.prototype.toLaTeX = function() {
  const args = this.args.map(arg => arg.toLaTeX())
  
  const lines = [texttt(
    `${this.visibility} ${this.stereotypePrefix}${this.name}(${args.join(", ")})`.encodeLaTeX()
  )]
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

  return subsubsectionmark(name)
    + "\n"
    +  subsubsection(name, true)
    + "\n"
    + itemize(members.map((member) => ` ${member.toLaTeX()}`), "label=,leftmargin=0pt")
    + "\n"
}

function relationsToLaTeX(name, relations) {
  let result = ""
  if (relations && relations.length) {
    result += "\\hfill\\break\\noindent" + textbf(`${name}: `)
    result += relations
      .map(relation => {
        if (relation.b instanceof UnresolvedObject) {
          let name = [...relation.b.package, relation.b.name].join(".")
          return texttt(name.encodeLaTeX())
        }
        return texttt(nameref("diagramObject:" + relation.b.name))
      })
      .join(", ") + "\n"
  }
  return result
}

DiagramObject.prototype.toLaTeX = function(config) {
  const packageName = this.package.removeCommonPrefix(config.packagePrefix).join(".")

  let stereotypes = ""
  if (this.stereotypes.length > 0) {
    stereotypes = ("«" + this.stereotypes.join(", ") + "» ").encodeLaTeX()
  }
  
  let result = subsubsectionmark(this.name) + "\n"
  if (config.createIndex) {
    result += index(this.name, "classes") + "\n"
  }
  result += subsubsection(
    text(
      stereotypes,
      texttt(textbf(this.nameWithGenerics)),
      "\\hfill",
      texttt(textbf(
        config.useFaIcons ? `\\faIcon{folder} ${packageName}` : packageName
      )),
      `\n`
    ), false, this.name
  ) + label("diagramObject:" + this.name) + "\n"
  
  result += this.doc.toLaTeX() + "\n"
  
  // Relations
  const inheritanceRelations = []
  const implementsRelations = []
  for (const relation of config.relations.get(this) || []) {
    if (relation instanceof InheritanceRelation) {
      inheritanceRelations.push(relation)
    } else if (relation instanceof ImplementsRelation) {
      implementsRelations.push(relation)
    }
  }

  result += relationsToLaTeX(config.translations.extends, inheritanceRelations)
  result += relationsToLaTeX(config.translations.implements, implementsRelations)

  return result
}

ClassObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX(config.translations.attributes, this.attributes)
  section += membersToLaTeX(config.translations.methods, [...this.constructors, ...this.methods])

  return section
}

InterfaceObject.prototype.toLaTeX = function(config) {
  let section = DiagramObject.prototype.toLaTeX.bind(this)(config)
  section += membersToLaTeX(config.translations.methods, this.methods)

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
  createIndex: false,
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
    relations.set(relation.a, oldMapping.concat([relation]))
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

