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

import {
  Diagram,
  ClassObject, EnumObject, InterfaceObject, UnresolvedObject, PackageObject,
  Attribute, Method, Constructor, Argument,
  InheritanceRelation, ImplementsRelation, AssociativeRelation
} from "./model.mjs"

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

export function resolveObjects(diagram) {
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

export function inferAssociations(diagram) {
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


