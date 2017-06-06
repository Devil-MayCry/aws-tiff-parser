// Copyright 2017 huteng (huteng@gagogroup.com). All rights reserved.,
// Use of this source code is governed a license that can be found in the LICENSE file.

import {Validator, BadRequestResponse, SuccessResponse, ErrorResponse, DateUtil} from "sakura-node";

import {BaseController, Request, Response, NextFunction} from "../base/basecontroller";

import {TiffTilerService} from "../tifftiler/tifftilerservice";

export class TiffTilerController extends BaseController {
  static async addImageSplitTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let validator: Validator = new Validator();

      const year: number = validator.toNumber(req.body["year"], "invalid year");
      const month: number = validator.toNumber(req.body["month"], "invalid month");
      const day: number = validator.toNumber(req.body["day"], "invalid day");

      const zoom: number = validator.toNumber(req.body["maxZoom"], "invalid maxZoom");

      const bandArray: string [] = req.body["bands"].substring(0, req.query["bands"].length).split(",");

      await TiffTilerService.saveImagePathInRedis(year, month, day, zoom, bandArray);
    } catch (err) {
      next(err);
    }
  }
}