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

function parseAssociation(object, diagram, attr) {
  const MULTIPLICITY = /^(\*|[0-9]+)(\.\.(\*|[0-9]+))?$/
  const relation = new AssociativeRelation(
    object,
    diagram.getObject(attr.params[attr.params.length - 1])
  )
  let isStart = true
  for (let it = 0; it < attr.params.length - 1; it++) {
    const param = attr.params[it]
    if (param.includes("-")) {
      const index = param.indexOf("-")
      relation.headA = param.charAt(index - 1)
      relation.headB = param.charAt(index + 1)
      isStart = false
    } else {
      if (MULTIPLICITY.test(param)) {
        if (isStart) {
          relation.multiplicityA = param
        } else {
          relation.multiplicityB = param
        }
      } else {
        if (isStart) {
          if (relation.roleA == "") {
            relation.roleA = param
          } else {
            relation.name = param
          }
        } else {
          relation.roleB = param
        }
      }
    }
  }
  return relation
}

export function inferAssociations(diagram) {
  for (const [name, object] of diagram.objects.entries()) {
    const attr = object.doc.findAttribute("@assoc")
    if (attr) {
      diagram.addRelation(parseAssociation(object, diagram, attr))
    }
    
    if (object.doc.findAttribute("@noassoc") != null) {
      continue
    }
    
    if (object instanceof ClassObject) {
      for (const attribute of object.attributes) {
        const attr = attribute.doc.findAttribute("@assoc")
        if (attr) {
          diagram.addRelation(parseAssociation(object, diagram, attr))
        } else if (attribute.doc.findAttribute("@noassoc") == null) {
          const refs = attribute.type.collectNames()
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
}

export function addGetters(diagram) {
  for (const [name, object] of diagram.objects.entries()) {
    if (object instanceof ClassObject) {
      for (const attr of object.attributes) {
        const getter = new Method("+", `get${attr.name.capitalize()}`, [], attr.type.clone())
        object.addMethod(getter)
      }
    }
  }
}

