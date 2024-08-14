/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.115
 *
 * Copyright 2011-2022 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/CesiumGS/cesium/blob/main/LICENSE.md for full licensing details.
 */

import {
  EllipseGeometry_default
} from "./chunk-ZFVMR763.js";
import "./chunk-XZMVDNMN.js";
import "./chunk-WLWCEXRF.js";
import "./chunk-ZHYMC6SK.js";
import "./chunk-W6SZP5KG.js";
import "./chunk-DFVR3ENQ.js";
import "./chunk-F3YA3Y2Z.js";
import "./chunk-2FWRMUTY.js";
import "./chunk-H4564CJD.js";
import "./chunk-56WSGJNI.js";
import "./chunk-OO27MUXC.js";
import "./chunk-4H7PY4U5.js";
import "./chunk-TGR6INGR.js";
import "./chunk-4KYA7WJA.js";
import "./chunk-TTUZP4BO.js";
import "./chunk-BG4UCVXN.js";
import "./chunk-EGUDGAMB.js";
import "./chunk-PPH7OFP3.js";
import {
  Cartesian3_default,
  Ellipsoid_default
} from "./chunk-R5TH57WU.js";
import "./chunk-RHGJOWRC.js";
import "./chunk-SOWMRMWA.js";
import "./chunk-STW2DGFI.js";
import "./chunk-BBWDMCVU.js";
import "./chunk-XGI5BXZY.js";
import {
  defined_default
} from "./chunk-YWTJ2B4B.js";

// packages/engine/Source/Workers/createEllipseGeometry.js
function createEllipseGeometry(ellipseGeometry, offset) {
  if (defined_default(offset)) {
    ellipseGeometry = EllipseGeometry_default.unpack(ellipseGeometry, offset);
  }
  ellipseGeometry._center = Cartesian3_default.clone(ellipseGeometry._center);
  ellipseGeometry._ellipsoid = Ellipsoid_default.clone(ellipseGeometry._ellipsoid);
  return EllipseGeometry_default.createGeometry(ellipseGeometry);
}
var createEllipseGeometry_default = createEllipseGeometry;
export {
  createEllipseGeometry_default as default
};
