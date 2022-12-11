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
import {parse} from "graphql"
import {readFileSync} from "fs"
import {walkTree} from "./../utils.mjs"
import {resolveObjects, inferAssociations} from "./../passes.mjs"
import {
  Diagram,
  ClassObject, EnumObject, InterfaceObject, UnresolvedObject, PackageObject,
  Attribute, Method, Constructor, Argument,
  InheritanceRelation, ImplementsRelation, AssociativeRelation
} from "./../model.mjs"


class GraphQlVisitor {
  constructor(diagram) {
    this.diagram = diagram
    this.defaultVisibility = "-"
    this.package = []
    this.ignore = new Set(["Query", "Mutation", "Subscription"])
  }
  
  typeToString(node) {
    switch (node.kind) {
      case "ListType": return `List<${this.typeToString(node.type)}>`
      case "NamedType": return node.name.value
      case "NonNullType": return this.typeToString(node.type)
      default:
        throw "Unknown type kind: " + node.kind
    }
  }
  
  objectTypeDef(definition) {
    const object = new ClassObject(definition.name.value)
    for (const field of definition.fields) {
      object.addAttribute(new Attribute(
        this.defaultVisibility,
        field.name.value,
        this.typeToString(field.type)
      ))
    }
    object.package = [...this.package]
    this.diagram.addObject(object)
    
    return object
  }
  
  enumTypeDef(definition) {
    const object = new EnumObject(definition.name.value)
    for (const value of definition.values) {
      object.addConstant(value.name.value)
    }
    object.package = [...this.package]
    this.diagram.addObject(object)
  }
  
  inputTypeDef(definition) {
    const object = this.objectTypeDef(definition)
    object.package.push("inputs")
  }
  
  document(document) {
    for (const definition of document.definitions) {
      if (this.ignore.has(definition.name.value)) {
        continue
      }
      switch (definition.kind) {
        case "ObjectTypeDefinition": this.objectTypeDef(definition); break
        case "EnumTypeDefinition": this.enumTypeDef(definition); break
        case "InputObjectTypeDefinition": this.inputTypeDef(definition); break
        case "ScalarTypeDefinition": break
        default:
          throw "Unknown definition kind " + definition.kind
      }
    }
  }
}

const DEFAULT_CONFIG = {
  associations: true,
  basePackage: []
}

function loadGraphQL(schemaPath, diagram, config) {
  const document = parse(readFileSync(schemaPath).toString())
  const visitor = new GraphQlVisitor(diagram)
  visitor.package = [...config.basePackage, path.parse(schemaPath).name]
  visitor.document(document)
}

Diagram.fromGraphQLSchema = function(schemaPath, partialConfig) {
  const config = Object.assign({...DEFAULT_CONFIG}, partialConfig || {})
  
  const diagram = new Diagram()
  loadGraphQL(schemaPath, diagram, config)
  
  if (config.associations) {
    inferAssociations(diagram)
  }
  
  return diagram
}

Diagram.fromGraphQLProject = function(basePath, partialConfig) {
  const config = Object.assign({...DEFAULT_CONFIG}, partialConfig || {})
  
  const diagram = new Diagram()
  walkTree(basePath, filePath => {
    if (path.parse(filePath).ext == ".graphql") {
      loadGraphQL(filePath, diagram, config)
    }
  })
  
  if (config.associations) {
    inferAssociations(diagram)
  }
  
  return diagram
}

