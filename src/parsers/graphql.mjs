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
  Attribute, Method, Constructor, Argument, Constant,
  InheritanceRelation, ImplementsRelation, AssociativeRelation
} from "./../model.mjs"
import {
  Type, CollectionType, NamedType, VoidType, ListType, OptionalType, PrimitiveType, SetType, SourceType
} from "./../types.mjs"

class GraphQlVisitor {
  constructor(diagram, config) {
    this.diagram = diagram
    this.defaultVisibility = "-"
    this.package = []
    this.config = config
  }
  
  extractFromSource(node) {
    return node.loc.source.body.substring(node.loc.start, node.loc.end)
  }
  
  
  parseType(node, isOptional=true) {
    if (this.config.sourceTypes) {
      return new SourceType(this.extractFromSource(node))
    }
    let type = null
    switch (node.kind) {
      case "ListType": type = new ListType(this.parseType(node.type)); break
      case "NamedType":
        switch(node.name.value) {
          case "String": type = new PrimitiveType("string"); break
          case "Int": type = new PrimitiveType("int"); break
          case "Float": type = new PrimitiveType("float"); break
          case "Boolean": type = new PrimitiveType("boolean"); break
          case "ID": type = new PrimitiveType(this.config.idType); break
          default:
            type = new NamedType(node.name.value)
        }
      break
      case "NonNullType": return this.parseType(node.type, false)
      default:
        throw "Unknown type kind: " + node.kind
    }
    if (isOptional) {
      type = new OptionalType(type)
    }
    return type
  }
  
  objectTypeDef(definition) {
    const object = new ClassObject(definition.name.value)
    for (const field of definition.fields) {
      object.addAttribute(new Attribute(
        this.defaultVisibility,
        field.name.value,
        this.parseType(field.type)
      ))
    }
    object.package = [...this.package]
    this.diagram.addObject(object)
    
    for (const implementedInterface of definition.interfaces || []) {
      if (implementedInterface.kind == "NamedType") {
        this.diagram.addRelation(new ImplementsRelation(
          object,
          new UnresolvedObject(implementedInterface.name.value)
        ))
      }
    }
    
    return object
  }
  
  enumTypeDef(definition) {
    const object = new EnumObject(definition.name.value)
    for (const value of definition.values) {
      object.addConstant(new Constant(value.name.value))
    }
    object.package = [...this.package]
    this.diagram.addObject(object)
  }
  
  inputTypeDef(definition) {
    const object = this.objectTypeDef(definition)
    object.package.push("inputs")
  }
  
  interfaceTypeDef(definition) {
    const object = new InterfaceObject(definition.name.value)
    object.package = [...this.package]
    this.diagram.addObject(object)
  }
  
  document(document) {
    for (const definition of document.definitions) {
      if (this.config.ignore.has(definition.name.value)) {
        continue
      }
      switch (definition.kind) {
        case "ObjectTypeDefinition": this.objectTypeDef(definition); break
        case "EnumTypeDefinition": this.enumTypeDef(definition); break
        case "InputObjectTypeDefinition": this.inputTypeDef(definition); break
        case "ScalarTypeDefinition": break
        case "InterfaceTypeDefinition": this.interfaceTypeDef(definition); break
        default:
          throw "Unknown definition kind " + definition.kind
      }
    }
  }
}

const DEFAULT_CONFIG = {
  associations: true,
  basePackage: [],
  idType: "long",
  ignore: new Set(["Query", "Mutation", "Subscription"]),
  sourceTypes: false
}

function loadGraphQL(schemaPath, diagram, config) {
  const document = parse(readFileSync(schemaPath).toString())
  const visitor = new GraphQlVisitor(diagram, config)
  visitor.package = [...config.basePackage, path.parse(schemaPath).name]
  visitor.document(document)
}

Diagram.fromGraphQLSchema = function(schemaPath, partialConfig) {
  const config = Object.assign({...DEFAULT_CONFIG}, partialConfig || {})
  
  const diagram = new Diagram()
  loadGraphQL(schemaPath, diagram, config)
  
  resolveObjects(diagram)
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
  
  resolveObjects(diagram)
  if (config.associations) {
    inferAssociations(diagram)
  }
  
  return diagram
}

