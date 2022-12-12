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

export class View {
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
}

