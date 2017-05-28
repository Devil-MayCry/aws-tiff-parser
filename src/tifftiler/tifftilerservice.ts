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

/**
 * The Service is a timing service running on aws ec2 server
 * The task of the service is to transform sentinel-2 origin jp2 file to tiff files
 * And save the tiff files on aws S3
 * 
 * @export
 * @class TiffTilerService
 */
export class TiffTilerService {

  // static async testTransformImageToTiff(): Promise<void> {
  //   try {
  //     let testFirstFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/S/DG/2015/12/7/0/B09.jp2";
  //     let testSecondFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/S/DG/2015/12/27/0/B01.jp2";
  //     let testThirdFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/S/DG/2016/3/6/0/B02.jp2";
  //     let testForthFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/R/GT/2017/4/14/0/B12.jp2";


  //     const config: any = require("../../config/project.config.json");
  //     const outputTilesDir: string = config["sentinelImage"]["outputTilesDir"];

  //       await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testFirstFile, outputTilesDir);
  //       await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testSecondFile, outputTilesDir);
  //       await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testThirdFile, outputTilesDir);
  //       await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testForthFile, outputTilesDir);
  //       console.log("end tiff tiler");
  //   } catch(err) {

  //   }
  // }


  /**
   * Main service functon
   * Get all newest valid jp2 file path
   * Use gdal to transform these files to tiff files
   * Save them in aws s3, for image-browser project using
   * @static
   * 
   * @memberOf TiffTilerService
   */
  static async startTransformImageToTiff(): Promise<void> {
    try {
      let newestImagesPaths: string[] = await TiffTilerService.getAllNewestImagesPaths();
      console.log(newestImagesPaths);
      const config: any = require("../../config/project.config.json");
      const outputTilesDir: string = config["sentinelImage"]["outputTilesDir"];
      // for (let imagePath of newestImagesPaths) {
      //   await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imagePath, outputTilesDir);
      // }
    } catch (err) {
      throw err;
    }
  }

  static async usePythonCommandLineToSplitJpgToTiff(tiffImagePath: string, outputTilesDir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let pythonCodePath: string = path.resolve(`${__dirname}/../../pythonscript/tifftiler.py`);

      let options: any = {
        scriptPath: pythonCodePath,
        args: ["-z", "0-2", tiffImagePath, outputTilesDir]
      };


      PythonShell.run("", options,  (err: Error) => {

      });

      let  process: child_process.ChildProcess = child_process.spawn("python", [pythonCodePath, "-z", "0-5", tiffImagePath, outputTilesDir]);
      process.stderr.on("data", (err) => {
          console.log(err);
          reject(new Error("PYTHON_RUN_ERROR"));
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
  static async getAllNewestImagesPaths(): Promise<string[]> {
    let allSquareFoldersPathInS3: string[] = await TiffTilerService.getAllSquareFoldersPathInS3ForGdal_();
     // console.log(allSquareFoldersPathInS3);
    let allSquareNewestImagesFolderPathArray: string[] = await TiffTilerService.getAllSquareNewestImagesFolderPath_(allSquareFoldersPathInS3);
    let allNewestImagesPathArray: string[] = [];
    for (let eachNewestFolder of allSquareNewestImagesFolderPathArray) {
      let files: string [] =  await TiffTilerService.getFolderAllImagePath_(eachNewestFolder);
      allNewestImagesPathArray.push(...files);
    }
     // console.log(allNewestImagesPathArray);
    return allNewestImagesPathArray;
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
  private static async getAllImageFilesByWalkLibary_(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {

      let filePathArray: string[] =[];
      const config: any = require("../../config/project.config.json");
      const tilesDir: string = config["sentinelImage"]["inputTilesDir"];

      const walker = walk.walk(tilesDir);

      walker.on("file", function (root: any, fileStats: any, next: any) {
        if (fileStats.name.endsWith(".jp2")) {
          filePathArray.push(root + fileStats.name);
        }
        next();
      });

      walker.on("errors", function (root: any, nodeStatsArray: any, next: any) {
        next();
      });

      walker.on("end", function () {
        resolve(filePathArray);
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
      const outPutTilesDir: string = config["sentinelImage"]["inputTilesDir"];
      let fileSavedAllSquareFoldersPath: string = outPutTilesDir + "allSquareFolderPaths";

      try {
        let allSquareFoldersPathInS3: string[] = [];

        // If the file is exist
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
          stream.write(inputTilesDir + "/" + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/n");
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
          async.mapLimit(dirNames, 100, (eachDir, done) => {
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

  /**
   * Get a folder's all jp2 file path
   *
   * @private
   * @static
   * @param {string} parentPath
   * @returns {Promise<string[]>}
   *
   * @memberOf TiffTilerService
   */
  private static async getFolderAllImagePath_(parentPath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(parentPath, (err: NodeJS.ErrnoException, files: string[]) => {
        if (!err) {
          async.mapLimit(files, 100, (eachFile, done) => {
            fs.stat(parentPath + "/" + eachFile, (err: Error, stats: fs.Stats) => {
              if (stats.isFile() && eachFile.endsWith(".jp2")) {
                done(null, parentPath + "/" + eachFile);
              } else {
                done (null, null);
              }
            });
          }, (err: Error, values: string[]) => {
            if (err) throw err;
            let result: string[] = [];
            values.forEach((eachFile: string) => {
              if (eachFile) {
                result.push(eachFile);
              }
            });
            resolve(result);
          });
        }
      });
    });
  }

  /**
   * The child folder in square folder is /[year]/[month]/[day]/[sequence]
   * So find each child folder biggest number is the newest folder
   *
   * @private
   * @static
   * @param {string[]} squareFolderPathArray
   * @returns {Promise<string[]>}
   *
   * @memberOf TiffTilerService
   */
  private static async getAllSquareNewestImagesFolderPath_(squareFolderPathArray: string[]): Promise<string[]> {
    let newImagesFolderPathArray: string[] = [];
    for (let eachSquareFolderPath of squareFolderPathArray) {
      let newestYear: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath);
      let newestMonth: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath + "/" + newestYear);
      let newestDay: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath + "/" + newestYear + "/" + newestMonth);
      let newestSequence: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath + "/" + newestYear 
                                                                                    + "/" + newestMonth + "/" + newestDay);
      newImagesFolderPathArray.push(eachSquareFolderPath + "/" + newestYear 
                                    + "/" + newestMonth + "/" + newestDay + "/" + newestSequence);
    }
    return newImagesFolderPathArray;
  }

  /**
   * packeage node readdir function and return biggest number (newest) folder name 
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
          validChildFolder.sort((a: number,b: number) => {
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
