// Copyright 2016 Frank Lin (lin.xiaoe.f@gmail.com). All rights reserved.
// Use of this source code is governed a license that can be found in the LICENSE file.

import * as redis from "redis";

interface WaveFile {
  filePath: string;
  waveType: string;
}

/**
 * Wrapper of RedisClient.
 */
export class RedisHelper {
  private static instance_: RedisHelper;
  private redisClient_: redis.RedisClient;

  private redisHost: string = require("../../config/project.config.json")["redis"]["host"];


  constructor() {
    this.redisClient_ = redis.createClient(<any>{host: this.redisHost});
    console.log(`RedisHelper connects to ${this.redisHost}`);
  }

  static getInstance(): RedisHelper {
    if (!RedisHelper.instance_) {
      RedisHelper.instance_ = new RedisHelper();
    }
    return RedisHelper.instance_;
  }

  static setInstance(instance: RedisHelper): void {
    RedisHelper.instance_ = instance;
  }

  getClient(): redis.RedisClient {
    return this.redisClient_;
  }

  async saveImagesPathInRedis(iamgesInfos: WaveFile[], zoom: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let multi = this.redisClient_.multi();
      for (let imageInfo of iamgesInfos) {
          let imageInfoInString: string = `{"filePath": "${imageInfo.filePath}", "waveType":  "${imageInfo.waveType}", "zoom": "${zoom}"}`;
          console.log(imageInfoInString);
          multi.rpush("images_path", imageInfoInString);
          console.log("save");
      }

      multi.exec(function(errors: Error, results: any) {
        if (errors) {
          console.log("insert redis fail");
          reject();
        } else{
          console.log("insert redis success");
          resolve();
        }
      });
    });
  }

  async getImageSplitTask(): Promise<string> {
    return new Promise<string>(((resolve: (value: string) => void, reject: (error?: any) => void) => {
      this.redisClient_.rpop("images_path", (err: Error, imageInfoInString: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(imageInfoInString);
        }
      });
    }));
  }
}
