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
import {readdirSync} from "fs"

String.prototype.escapeHtml = function() {
  return this.split("<").join("&lt;").split(">").join("&gt;")
}

String.prototype.escapeGraphViz = function() {
  return "\"" + this + "\""
}

String.prototype.splitOne = function(delim) {
  const index = this.indexOf(delim)
  if (index == -1) {
    return [this]
  }
  return [this.substr(0, index), this.substr(index + 1)]
}

String.prototype.capitalize = function() {
  if (this.length > 0) {
    return this.charAt(0).toUpperCase() + this.substr(1)
  }
  return ""
}

Array.prototype.removeCommonPrefix = function(other) {
  let prefixLength = 0
  while (prefixLength < this.length &&
         prefixLength < other.length &&
         this[prefixLength] == other[prefixLength]) {
    prefixLength++
  }
  return this.slice(prefixLength)
}

export class BlockNode {
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

export class BlockSection {
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

export function walkTree(basePath, func) {
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

