// Copyright 2017 huteng (huteng@gagogroup.com). All rights reserved.,
// Use of this source code is governed a license that can be found in the LICENSE file.

import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";

import * as cron from "cron";
import * as PythonShell from "python-shell";
import * as async from "async";
import * as child_process from "child_process";

const walk = require("walk")

interface WaveFile {
  filePath: string;
  waveType: string;
}

const config: any = require("../../config/project.config.json");

const OUT_PUT_TILES_DIR: string = config["sentinelImage"]["outputTilesDir"];
const IN_PUT_TILES_DIR: string = config["sentinelImage"]["inputTilesDir"];

/**
 * The Service is a timing service running on aws ec2 server
 * The task of the service is to transform sentinel-2 origin jp2 file to tiff files
 * And save the tiff files on aws S3
 * 
 * @export
 * @class TiffTilerService
 */
export class TiffTilerService {

  /**
   * Main service functon
   * Get all newest valid jp2 file path
   * Use gdal to transform these files to tiff files
   * Save them in aws s3, for image-browser project using
   * @static
   *
   * @memberOf TiffTilerService
   */
  static async startTransformImageToTiff(year: number, month: number, maxZoom: number, waveArray: string[]): Promise<void> {
    try {
      const config: any = require("../../config/project.config.json");
      const outputTilesDir: string = config["sentinelImage"]["outputTilesDir"];
      const inputTilesDir: string = config["sentinelImage"]["inputTilesDir"];

      await TiffTilerService.getSplitedImagesPaths(year, month, waveArray, maxZoom);
      // let imagesInfos: WaveFile[] = [{ "filePath": "/mountdata/s3-sentinel-2/tiles/56/M/KT/2017/5/1/0/B01.jp2",  "waveType": "B01" },
      //    { "filePath": "/mountdata/s3-sentinel-2/tiles/56/M/KT/2017/5/1/0/B02.jp2",    "waveType": "B02" },
      //    { "filePath": "/mountdata/s3-sentinel-2/tiles/56/M/LC/2017/5/14/0/B02.jp2",    "waveType": "B02" },
      //    { "filePath": "/mountdata/s3-sentinel-2/tiles/56/M/LC/2017/5/14/0/B01.jp2",    "waveType": "B01" },
      //    ]


      // await TiffTilerService.createFolder(outputTilesDir, waveArray);

      // async.eachLimit(imagesInfos, 3, (imageInfo, done) => {
      //   TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imageInfo, outputTilesDir, inputTilesDir, maxZoom).then(() => {
      //     done();
      //   });
      // }, (err: Error) => {
      //   if (err) {
      //     console.log(err);
      //     throw(err);
      //   }
      // });

      // for (let imageInfo of imagesInfos) {
      //   TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imageInfo, outputTilesDir, inputTilesDir, maxZoom);
      // }
    } catch (err) {
      throw err;
    }
  }

  static async createFolder(outputTilesDir: string, waveArray: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      async.each(waveArray, (wave, done) => {
        let outputDir: string = outputTilesDir + wave;
        fs.stat(outputDir, (err, stats) => {
          if (stats) {
            done();
          }else {
            fs.mkdirSync(outputDir);
            done();
          }
        });
      }, (err: Error) => {
        if (err) reject(err);
        else {
          resolve();
        }
      });
    });
  }

  static async usePythonCommandLineToSplitJpgToTiff(tiffImagePath: WaveFile, outputTilesDir: string, inputTilesDir: string, maxZoom: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let pythonCodePath: string = path.resolve(`${__dirname}/../../pythonscript/tifftiler.py`);

      // 分解图片路径，获取年月日，作为输出路径

      let filePath: string = tiffImagePath.filePath;
      console.log("start split...");

      console.log(filePath);

      let dirPath: string = filePath.replace(inputTilesDir, "");
      let dirArray: string[] = dirPath.split("/");
      let timePath = dirArray[3] + "/" + dirArray[4] + "/" + dirArray[5] + "/";
      let outputDir: string = outputTilesDir  + timePath + tiffImagePath.waveType;

      fs.stat(outputDir, (err, stats) => {
        if (stats) {
          let  process: child_process.ChildProcess = child_process.spawn("/root/miniconda3/bin/python", [pythonCodePath, "-z", `0-${maxZoom}`, filePath, outputDir]);
          process.stderr.on("data", (err) => {
            if (err) {
              reject(new Error("PYTHON_RUN_ERROR"));
            }
          });
          process.on("close", (code) => {
            resolve();
          });
        } else {
          fs.mkdir(outputDir, () => {
            let  process: child_process.ChildProcess = child_process.spawn("/root/miniconda3/bin/python", [pythonCodePath, "-z", `0-${maxZoom}`, filePath, outputDir]);
            process.stderr.on("data", (err) => {
              if (err) {
                reject(new Error("PYTHON_RUN_ERROR"));
              }
            });
            process.on("close", (code) => {
              console.log("split..end.");
              resolve();
            });
          });
        }
      });
    });
  }
  /**
   * Get all newest images (jp2) paths in s3, for gdal transform to tiff later
   *
   * @static
   * @returns {Promise<string[]>}
   *
   * @memberOf TiffTilerService
   */
  static async getSplitedImagesPaths(year: number, month: number, waveArray: string[], maxZoom: number): Promise<void> {
    let allSquareFoldersPathInS3: string[] = await TiffTilerService.getAllSquareFoldersPathInS3ForGdal_();
    console.log(allSquareFoldersPathInS3);
    await TiffTilerService.getAllSpecifyImagesPath_(allSquareFoldersPathInS3, year, month, waveArray, maxZoom);
  }

  /**
   * find All jp2 files paths in a folder
   *
   * @private
   * @static
   * @returns {Promise<string[]>}
   *
   * @memberOf TiffTilerService
   */
  private static async getAllImageFilesByWalkLibary_(rootDir: string, waveArray: string[], maxZoom: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {

      let filePathArray: WaveFile[] = [];

      const walker = walk.walk(rootDir);

      walker.on("file", function (root: any, fileStats: any, next: any) {
        let fileName: string =  fileStats.name;
        if (fileName.endsWith(".jp2")) {
          let waveNameInArray: string[] = fileName.split(".");
          let wave: string = waveNameInArray[0];
          if (waveArray.indexOf(wave) !== -1 && root.indexOf("preview") === -1) {
            let imageInfo: WaveFile = {filePath: root + "/" + fileName, waveType: wave};
            TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imageInfo, OUT_PUT_TILES_DIR, IN_PUT_TILES_DIR, maxZoom).then(() => {
              next();
            });
          }
        }
      });

      walker.on("errors", function (root: any, nodeStatsArray: any, next: any) {
        console.log("walk error");
        next();
      });

      walker.on("end", function () {
        console.log("walk end");
        resolve();
      });
    });
  }

  /**
   * The files folder in sentinel-2 s3 is tiles/[UTM code]/latitude band/square/[year]/[month]/[day]/[sequence]/DATA
   * Find all images in newest day paths
   * Write All square folder path in a file
   *
   * FBI warning: During the test, the method is too,too slow in aws S3.
   * I don't know the reason is the beacause of S3 , or my algorithm, which looks like sync
   *
   * @private
   * @static
   * @returns {string[]}
   *
   * @memberOf TiffTilerService
   */
  private static async getAllSquareFoldersPathInS3ForGdal_(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {


      // If all square path have been saved, Use the file to get them
      const config: any = require("../../config/project.config.json");
      const outPutTilesDir: string = config["sentinelImage"]["outputTilesDir"];
      let fileSavedAllSquareFoldersPath: string = outPutTilesDir + "allSquareFolderPaths.txt";

      try {
        let allSquareFoldersPathInS3: string[] = [];

        // If the file is exist
        fs.accessSync(fileSavedAllSquareFoldersPath);

        let lineReader: readline.ReadLine = readline.createInterface({
          input: fs.createReadStream(fileSavedAllSquareFoldersPath)
        });

        lineReader.on("line", (line: any) => {
          allSquareFoldersPathInS3.push(line.toString());
        }).on("close", () => {
          resolve(allSquareFoldersPathInS3);
        });

      } catch (err) {
        TiffTilerService.readToGetAllSquareFoldersPathInS3_(fileSavedAllSquareFoldersPath).then((allSquareFoldersPathInS3: string[]) =>{
          resolve(allSquareFoldersPathInS3);
        });
      }
    });
  }

  private static async readToGetAllSquareFoldersPathInS3_(fileSavedAllSquareFoldersPath: string): Promise<string[]> {
    const config: any = require("../../config/project.config.json");
    const inputTilesDir: string = config["sentinelImage"]["inputTilesDir"];
    const stream: fs.WriteStream = fs.createWriteStream(fileSavedAllSquareFoldersPath);

    let allSquareFoldersPathInS3: string[] = [];

    let utmCodeFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(inputTilesDir);
    for (let eachUtmCodeFolderName of utmCodeFolderNameArray) {
      let latitudeBandFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(inputTilesDir + "/" + eachUtmCodeFolderName);
      for (let eachLatitudeBandFolderName of latitudeBandFolderNameArray) {
        let squareFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(inputTilesDir + "/" + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName);
        for (let eachName of squareFolderNameArray) {
          allSquareFoldersPathInS3.push(inputTilesDir + "/" + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName);
          // console.log(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/");
          stream.write(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/" + `\n`);
        }
      }
    }
    stream.end();
    return allSquareFoldersPathInS3;
  }

  /**
   * find folder's child folder name
   *
   * @private
   * @static
   * @param {string} parentPath
   * @returns {Promise<string[]>}
   *
   * @memberOf TiffTilerService
   */
  private static async getAllChildFolderName_(parentPath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(parentPath, (err: NodeJS.ErrnoException, dirNames: string[]) => {
        if (!err) {
          async.map(dirNames, (eachDir, done) => {
            fs.stat(parentPath + "/" + eachDir, (err: Error, stats: fs.Stats) => {
              if (stats.isDirectory()) {
                done(null, eachDir);
              } else {
                done (null, null);
              }
            });
          }, (err: Error, values: string[]) => {
            if (err) throw err;
            let result: string[] = [];
            values.forEach((eachDir: string) => {
              if (eachDir) {
                result.push(eachDir);
              }
            });
            resolve(result);
          });
        }
      });
    });
  }

  // /**
  //  * Get a folder's all jp2 file path
  //  *
  //  * @private
  //  * @static
  //  * @param {string} parentPath
  //  * @returns {Promise<string[]>}
  //  *
  //  * @memberOf TiffTilerService
  //  */
  // private static async getFolderAllImagePath_(parentPath: string): Promise<string[]> {
  //   return new Promise<string[]>((resolve, reject) => {
  //     fs.readdir(parentPath, (err: NodeJS.ErrnoException, files: string[]) => {
  //       if (!err) {
  //         async.mapLimit(files, 100, (eachFile, done) => {
  //           fs.stat(parentPath + "/" + eachFile, (err: Error, stats: fs.Stats) => {
  //             if (stats.isFile() && eachFile.endsWith(".jp2")) {
  //               done(null, parentPath + "/" + eachFile);
  //             } else {
  //               done (null, null);
  //             }
  //           });
  //         }, (err: Error, values: string[]) => {
  //           if (err) throw err;
  //           let result: string[] = [];
  //           values.forEach((eachFile: string) => {
  //             if (eachFile) {
  //               result.push(eachFile);
  //             }
  //           });
  //           resolve(result);
  //         });
  //       }
  //     });
  //   });
  // }

  /**
   * The child folder in square folder is /[year]/[month]/[day]/[sequence]
   * So find each child folder biggest number is the newest folder
   *
   * No use for now
   *
   * @private
   * @static
   * @param {string[]} squareFolderPathArray
   * @returns {Promise<string[]>}
   *
   * @memberOf TiffTilerService
   */
  private static async getAllSpecifyImagesPath_(squareFolderPathArray: string[], year: number, month: number, waveArray: string[], maxZoom: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let imagePathArray: WaveFile[] = [];


      async.map(squareFolderPathArray, (eachDir, done) => {
        let folderPath: string = eachDir + year + "/" + month;
        fs.stat(folderPath, (err: Error, stats: fs.Stats) => {
            console.log(folderPath);
          if (stats && stats.isDirectory()) {
              console.log("exist, done");
            TiffTilerService.getAllImageFilesByWalkLibary_(folderPath, waveArray, maxZoom).then(() => {
              done();
            });
          } else {
            console.log("no exist, done");
            done();
          }
        });
      }, (err: Error, values: string[]) => {
        console.log("finsih");
        resolve();
        // if (err) {
        //   resolve();
        // }else {
        //   resolve(imagePathArray);
        // }
      });
    });
  }

  /**
   * packeage node readdir function and return biggest number (newest) folder name 
   *
   * No use for now
   *
   * @private
   * @static
   * @param {string} parentPath
   * @returns {Promise<string>}
   *
   * @memberOf TiffTilerService
   */
  private static async findNewestChildFolderUtil_(parentPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readdir(parentPath, (err: NodeJS.ErrnoException, dirNames: string[]) => {
        if (!err) {
          let validChildFolder: number[] = [];
          for (let eachDirName of dirNames) {
            if (!isNaN(Number(eachDirName))) {
              validChildFolder.push(Number(eachDirName));
            }
          }
          // sort from biggest to lowest
          validChildFolder.sort((a: number, b: number) => {
            return b - a;
          });
          if (validChildFolder.length > 0) {
            resolve(validChildFolder[0].toString());
          } else {
            resolve(null);
          }
        }
      });
    });
  };
}
