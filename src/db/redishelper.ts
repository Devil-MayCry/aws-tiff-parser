// Copyright 2016 Frank Lin (lin.xiaoe.f@gmail.com). All rights reserved.
// Use of this source code is governed a license that can be found in the LICENSE file.

import * as redis from "redis";

import * as _ from "lodash";

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
    console.log(`RedisHelper connects to ${this.redisHost}`);
    this.redisClient_ = redis.createClient(<any>{host: this.redisHost});
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

  async saveImagesPathInRedis(iamgesInfos: WaveFile[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let multi = this.redisClient_.multi();
      for (let imageInfo of iamgesInfos) {
          let imageInfoInString: string = `{filePath: ${imageInfo.filePath}, waveType:  ${imageInfo.waveType}`;
          console.log(imageInfoInString);
          console.log("save");
          multi.rpush("images_path", imageInfoInString);
      }

      multi.exec(function(errors, results) {
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

   /**
   * Find all radar picture resource keys when radar website down
   * @param time timestamp.
   * @return string[]
   */
  async findLastRadarResource(): Promise<string> {
    return new Promise<string>(((resolve: (value: string) => void, reject: (error?: any) => void) => {

      this.redisClient_.keys("radar_resource_*", (err: Error | void, reply: string[]) => {
        if (err)   reject(err);
        if (reply.length === 0) resolve(null);
        this.redisClient_.get(_.max(reply), function(err: Error | void, reply: string) {
          if (err) {
            reject(err);
          }
          resolve(reply);
        });
      });
    }));
  }


 /**
   * Find radar picture data by given time.
   * @param time time.
   */
  async findRadarDataByTime(time: timestamp): Promise<string> {
    return new Promise<string>(((resolve: (value: string) => void, reject: (error?: any) => void) => {
      this.redisClient_.get(RedisHelper.radarDataKeyInRedis_(time), function(err: Error | void, reply: string) {
        if (err) {
          reject(err);
        }
        resolve(reply);
      });
    }));
  }

  /**
   * Save a token for Chui Zi (wuqingchun@gagogroup.com)'s server post a add task message request\
   * Defalut key is gdc_longrun, value is 666666
   * @param time time.
   * @param radarData radar pic binary data.
   */
  async saveGdcServerToken(key: string = "gdc_longrun", value: string = "666666"): Promise<void> {
    this.redisClient_.set(`token_${key}`, value, function(err: Error | void, reply: string) {
      if (err) {
        throw err;
      }
    });
  }

  /**
   * Save radar resourece to cache, key is time.
   * @param time time.
   * @param radar resoure data
   */
  async saveRadarResourceWithTime(time: number, radarResource: any): Promise<void> {
    const key: string = RedisHelper.radarResourceKeyInRedis_(time);
    this.redisClient_.set(key, JSON.stringify(radarResource), function(err: Error | void, reply: string) {
      if (err) {
        throw err;
      } else {
        return;
      }
    });

    this.redisClient_.expireat(key, RedisHelper.radarDataExpiredTimestamp_());
  }

  /**
   * Save radar data to cache, key is time.
   * @param time time.
   * @param radarData radar pic binary data.
   */
  async saveRadarDataWithTime(time: number, radarData: Buffer): Promise<void> {
    const key: string = RedisHelper.radarDataKeyInRedis_(time);
    this.redisClient_.set(key, radarData.toString("binary"), function(err: Error | void, reply: string) {
      if (err) {
        throw err;
      } else {
        return;
      }
    });

    this.redisClient_.expireat(key, RedisHelper.radarDataExpiredTimestamp_());
  }

  /**
   * Find UID by given token.
   * @param token Token.
   */
  async findUidByToken(token: string): Promise<number> {
    return new Promise<number>(((resolve: (value: number) => void, reject: (error?: any) => void) => {
      this.redisClient_.get(RedisHelper.tokenKeyInRedis_(token), function(err: Error | void, reply: string) {
        if (err) {
          reject(err);
        }
        resolve(Number(reply));
      });
    }));
  }

  /**
   * Save UID to cache, key is token.
   * @param token Token.
   * @param uid UID.
   */
  async saveUidWithToken(token: string, uid: number): Promise<void> {
    const key: string = RedisHelper.tokenKeyInRedis_(token);

    this.redisClient_.set(key, String(uid), function(err: Error | void, reply: string) {
      if (err) {
        throw err;
      } else {
        return;
      }
    });

    this.redisClient_.expireat(key, RedisHelper.tokenExpiredTimestamp_());
  }

  /**
   * Save UID to cache, key is retrieve password token.
   * @param token Token.
   * @param uid UID.
   */
  async saveRetrievePasswordStateWithToken(token: string, uid: number): Promise<void> {
    const key: string = RedisHelper.tokenKeyInRedis_(token);

    this.redisClient_.set(key, String(uid), function(err: Error | void, reply: string) {
      if (err) {
        throw err;
      } else {
        return;
      }
    });

    this.redisClient_.expireat(key, RedisHelper.retrievePasswordExpiredTimestamp_());
  }

  /**
   * Gets value as string.
   * @param key Key in redis.
   * @returns {Promise<string>} Value as string in redis.
   */
  async getAsString(key: string): Promise<nullable<string>> {
    return new Promise<string>(((resolve: (value: string) => void, reject: (error?: any) => void) => {
      this.redisClient_.get(key, function(err: Error | void, reply: string) {
        if (err) {
          reject(err);
        }
        resolve(reply);
      });
    }));
  }

  /**
   * Set string to redis.
   * @param key Key.
   * @param value Value
   * @param expiredAt Expired at.
   */
  async saveString(key: string, value: string, expiredAt?: timestamp): Promise<void> {
    this.redisClient_.set(key, value, function(err: Error | void, reply: string) {
      if (err) {
        throw err;
      } else {
        return;
      }
    });

    if (expiredAt) {
      this.redisClient_.expireat(key, expiredAt);
    }
  }

  private static tokenKeyInRedis_(token: string): string {
    return `token_${token}`;
  }

  private static radarDataKeyInRedis_(time: number): string {
    return `radar_data_${time}`;
  }

  private static radarResourceKeyInRedis_(time: timestamp): string {
    return `radar_resource_${time}`;
  }

  // private static retrievePasswordtokenKeyInRedis_(token: string): string {
  //   return `retrieve_password_token_${token}`;
  // }

  /**
   * Expired data is 7 days later.
   * @returns {number}
   */
  private static tokenExpiredTimestamp_(): number {
    let today: Date = new Date();
    today.setDate(today.getDate() + 7);
    return Math.floor(today.getTime() / 1000);
  }

  /**
   * Expired data is 7 days later.
   * @returns {number}
   */
  private static radarDataExpiredTimestamp_(): number {
    let today: Date = new Date();
    today.setDate(today.getDate() + 7);
    return Math.floor(today.getTime() / 1000);
  }

  /**
   * Expired data is 20 minutes later.
   * @returns {number}
   */
  private static retrievePasswordExpiredTimestamp_(): number {
    let today: Date = new Date();
    today.setMinutes(today.getMinutes() + 20);
    return Math.floor(today.getTime() / 1000);
  }
}
