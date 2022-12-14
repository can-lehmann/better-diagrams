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

// Better Diagrams Type System
// - By default all values are non-nullable
// - Use OptionalType(...) to make them nullable
// - Primitive types are:
//   - boolean, byte, char, short, int, long
//   - float, double
//   - string

export class Type {
  constructor() { }
  substitute(mapping) { }
  collectNames() { return new Set() }
  toString() { return "<type>" }
}

export class CollectionType extends Type {
  constructor(item) {
    super()
    this.item = item
  }
  
  clone() {
    return new (this.constructor)(this.item.clone())
  }
  
  collectNames() { return this.item.collectNames() }
  substitute(mapping) { this.item.substitute(mapping) }
  toString() { return `Collection<${this.item.toString()}>` }
}

export class VoidType extends Type {
  clone() { return this }
  toString() { return "void" }
}

export class NamedType extends Type {
  constructor(name) {
    super()
    this.name = name
  }
  
  clone() {
    return new NamedType(this.name)
  }
  
  substitute(mapping) {
    if (mapping.has(this.name)) {
      this.name = mapping.get(this.name)
    }
  }
  
  collectNames() {
    return new Set([this.name])
  }
  
  toString() {
    return this.name
  }
}

export class PrimitiveType extends NamedType {
  clone() { return new PrimitiveType(this.name) }
  collectNames() { return new Set() }
}

export class ListType extends CollectionType {
  toString() { return `List<${this.item}>` }
}

export class SetType extends CollectionType {
  toString() { return `Set<${this.item}>` }
}

export class OptionalType extends CollectionType {
  toString() { return `Optional<${this.item}>` }
}

// Type that is still in source code form (not parsed)
export class SourceType extends Type {
  constructor(source) {
    super()
    this.source = source
  }
  
  collectNames() {
    return new Set(this.source
      .split(/\>|\<|\(|\)|\[|\]|\{|\}|,|\||\./)
      .filter(name => name != "")
    )
  }
  
  clone() { return new SourceType(this.source) }
  toString() { return this.source }
}
