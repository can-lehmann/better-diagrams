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

import {Diagram, buildPackageTree} from "./src/lib.mjs"

const basePath = process.argv[2]
const diagram = Diagram.fromJavaProject(basePath)
const packageTree = buildPackageTree(diagram)

diagram
  .view(packageTree)
  .withAdjacent()
  .saveGraphViz("graph.gv")


