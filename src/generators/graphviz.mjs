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
  Attribute, Method, Constructor, Argument,
  InheritanceRelation, ImplementsRelation, AssociativeRelation
} from "./../model.mjs"

DiagramObject.prototype.toGraphViz = function(config, isExternal=false) {
  const header = new BlockSection("center", [])
  if (this.stereotypes.length > 0) {
    header.addLine("«" + this.stereotypes.join(", ") + "»")
  }
  
  let name = this.nameWithGenerics.escapeHtml()
  if (config.nameFontSize != null) {
    name = `<font point-size="${config.nameFontSize}">${name}</font>`
  }
  header.addLine(name)
  
  const block = new BlockNode([header])
  if (isExternal) {
    header.addLine(`(from ${this.package.join(".")})`)
  } else if (!config.hideMembers) {
    block.addSections(this.toBlockSections(config.onlyImportant))
  }
  
  const label = block.toHtmlTable()
  return `${this.name.escapeGraphViz()} [shape=none, label=<${label}>];\n`
}

PackageObject.prototype.toGraphViz = function(config, external=false) {
  const objects = []
  for (const [name, object] of this.objects.entries()) {
    objects.push(object.toGraphViz(config))
  }
  return `subgraph {
    cluster=true;
    color=black;
    label=${this.name.escapeGraphViz()};
    labeljust=l;
    labelloc="b";
    fontsize=16;
    ${objects.join("\n")}
  };`
}

Relation.prototype.toGraphViz = function() {
  return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()};`
}

InheritanceRelation.prototype.toGraphViz = function() {
  return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [arrowhead=onormal, weight=10];`
}

ImplementsRelation.prototype.toGraphViz = function() {
  return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [arrowhead=onormal, weight=10, style=dashed];`
}

AssociativeRelation.prototype.toGraphViz = function() {
  const toArrowType = kind => {
    switch(kind) {
      case ">":
      case "<":
        return "vee"
      case "o":
        return "odiamond"
      case "*":
        return "diamond"
      default:
        return "none"
    }
  }
  
  return `${this.a.name.escapeGraphViz()} -> ${this.b.name.escapeGraphViz()} [
    weight=1,
    label=${this.name.escapeGraphViz()},
    headlabel=${(this.roleB + "\n" + this.multiplicityB).escapeGraphViz()},
    taillabel=${(this.roleA + "\n" + this.multiplicityA).escapeGraphViz()},
    arrowtail=${toArrowType(this.headA)},
    arrowhead=${toArrowType(this.headB)},
    minlen=${this.visual.flat ? 0 : 1},
    dir=both
  ];`
}

const DEFAULT_CONFIG = {
  dpi: 72,
  rankdir: "BT",
  onlyImportant: false,
  hideMembers: false,
  nameFontSize: null
}

View.prototype.toGraphViz = function(partialConfig) {
  const config = Object.assign({...DEFAULT_CONFIG}, partialConfig || {})
  
  let output = "digraph {\n"
  output += `rankdir=${config.rankdir};\n`
  output += `dpi=${config.dpi};` + "\n"
  
  const {objects, adjacent, relations} = this.planRender()
  
  for (const object of objects) {
    output += object.toGraphViz(config)
  }
  for (const object of adjacent) {
    output += object.toGraphViz(config, true)
  }
  
  for (const relation of relations) {
    output += relation.toGraphViz() + "\n"
  }
  
  output += "}\n"
  return output
}

View.prototype.saveGraphViz = function(filePath, partialConfig) {
  writeFileSync(filePath, this.toGraphViz(partialConfig))
}

