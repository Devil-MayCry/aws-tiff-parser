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
      let imagesInfos: WaveFile[] = await TiffTilerService.getSplitedImagesPaths(year, month, waveArray);
      const config: any = require("../../config/project.config.json");
      const outputTilesDir: string = config["sentinelImage"]["outputTilesDir"];
      for (let imageInfo of imagesInfos) {
        await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imageInfo, outputTilesDir, maxZoom);
      }
    } catch (err) {
      throw err;
    }
  }

  static async usePythonCommandLineToSplitJpgToTiff(tiffImagePath: WaveFile, outputTilesDir: string, maxZoom: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let pythonCodePath: string = path.resolve(`${__dirname}/../../pythonscript/tifftiler.py`);

      // let options: any = {
      //   scriptPath: pythonCodePath,
      //   args: ["-z", `0-${maxZoom}`, tiffImagePath, outputTilesDir]
      // };


      // PythonShell.run("", options,  (err: Error) => {

      // });
      let filePath: string = tiffImagePath.filePath;
      let outputDir: string = outputTilesDir + tiffImagePath.waveType;
      console.log(filePath);
      console.log(outputDir);
      fs.stat(outputDir, (err: Error, stats: fs.Stats) => {
        if (stats && stats.isDirectory()) {
          // do nothing
        } else {
          fs.mkdirSync(outputDir);
        }
        // let  process: child_process.ChildProcess = child_process.spawn("python", [pythonCodePath, "-z", `0-${maxZoom}`, filePath, outputDir]);
        // process.stderr.on("data", (err) => {
        //     console.log(err);
        //     reject(new Error("PYTHON_RUN_ERROR"));
        // });
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
  static async getSplitedImagesPaths(year: number, month: number, waveArray: string[]): Promise<WaveFile[]> {
    let allSquareFoldersPathInS3: string[] = await TiffTilerService.getAllSquareFoldersPathInS3ForGdal_();
     // console.log(allSquareFoldersPathInS3);
    let allSpecifyImagesPathArray: WaveFile[] = await TiffTilerService.getAllSpecifyImagesPath_(allSquareFoldersPathInS3, year, month, waveArray);
     // console.log(allNewestImagesPathArray);
    return allSpecifyImagesPathArray;
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
  private static async getAllImageFilesByWalkLibary_(rootDir: string, waveArray: string[]): Promise<WaveFile[]> {
    return new Promise<WaveFile[]>((resolve, reject) => {

      let filePathArray: WaveFile[] =[];

      const walker = walk.walk(rootDir);

      walker.on("file", function (root: any, fileStats: any, next: any) {
        let fileName: string =  fileStats.name;
        console.log(fileName);
        if (fileName.endsWith(".jp2")) {
          let waveNameInArray: string[] = fileName.split(".");
          let wave: string = waveNameInArray[0]

          if (waveArray.indexOf(wave) !== -1) {
            filePathArray.push({filePath: root + fileName, waveType: wave});
          }
        }
        next();
      });

      walker.on("errors", function (root: any, nodeStatsArray: any, next: any) {
        next();
      });

      walker.on("end", function () {
        console.log(filePathArray);
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
      const outPutTilesDir: string = config["sentinelImage"]["outputTilesDir"];
      let fileSavedAllSquareFoldersPath: string = outPutTilesDir + "allSquareFolderPaths.txt";
      console.log(fileSavedAllSquareFoldersPath);

      try {
        let allSquareFoldersPathInS3: string[] = [];

        // If the file is exist
        fs.accessSync(fileSavedAllSquareFoldersPath);
      console.log("eeeeee");

        let lineReader: readline.ReadLine = readline.createInterface({
          input: fs.createReadStream(fileSavedAllSquareFoldersPath)
        });
      console.log("ttttttt");

        lineReader.on("line", (line: any) => {
          console.log(line.toString());
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
          console.log(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/");
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
  private static async getAllSpecifyImagesPath_(squareFolderPathArray: string[], year: number, month: number, waveArray: string[]): Promise<WaveFile[]> {
    return new Promise<WaveFile[]>((resolve, reject) => {
      let imagePathArray: WaveFile[] = [];
      async.mapLimit(squareFolderPathArray, 100, (eachDir, done) => {
        let folderPath: string = eachDir + year + "/" + month;
        console.log(folderPath);
        fs.stat(folderPath, (err: Error, stats: fs.Stats) => {
          if (stats.isDirectory()) {
            TiffTilerService.getAllImageFilesByWalkLibary_(folderPath, waveArray).then((data: WaveFile[]) => {
              imagePathArray.concat(data);
              done();
            });
          }
        });
      }, (err: Error, values: string[]) => {
        if (err) throw err;
        resolve(imagePathArray);
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
