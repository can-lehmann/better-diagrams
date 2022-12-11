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

// Better Diagrams

/*
 * Todo List:
 * - Private classes
 * - Constructors
 * - AssociativeRelation
 *   - Aggregation/Compositon
 *   - Number of Items
 *
 * Large Tasks:
 * - Preserve Doc Comments
 * - GraphQL Import
 * - TypeScript Import
 * - PlantUML Export
 * - Interactive positioning
 */

import {Diagram} from "./model.mjs"
import {View} from "./rendering.mjs"
import {buildPackageTree, inferAssociations} from "./passes.mjs"

import "./parsers/java.mjs"
import "./parsers/graphql.mjs"

export { Diagram, View, buildPackageTree, inferAssociations }

