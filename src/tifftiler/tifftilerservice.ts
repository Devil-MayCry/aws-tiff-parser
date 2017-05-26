// Copyright 2017 huteng (huteng@gagogroup.com). All rights reserved.,
// Use of this source code is governed a license that can be found in the LICENSE file.

import * as fs from "fs";
import * as path from "path";

import * as cron from "cron";
import * as PythonShell from "python-shell";
import * as async from "async";

/**
 * The Service is a timing service running on aws ec2 server
 * The task of the service is to transform sentinel-2 origin jp2 file to tiff files
 * And save the tiff files on aws S3
 * 
 * @export
 * @class TiffTilerService
 */
export class TiffTilerService {

  static async testTransformImageToTiff(): Promise<void> {
    try {
      let testFirstFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/S/DG/2015/12/7/0/B09.jp2";
      let testSecondFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/S/DG/2015/12/27/0/B01.jp2";
      let testThirdFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/S/DG/2016/3/6/0/B02.jp2";
      let testForthFile: string = "/home/ec2-user/s3-sentinel-2/tiles/10/R/GT/2017/4/14/0/B12.jp2";


      const config: any = require("../../config/project.config.json");
      const outputTilesDir: string = config["sentinelImage"]["outputTilesDir"];

        await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testFirstFile, outputTilesDir);
        await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testSecondFile, outputTilesDir);
        await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testThirdFile, outputTilesDir);
        await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(testForthFile, outputTilesDir);
        console.log("end tiff tiler");
    } catch(err) {

    }
  }


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
      let newestImagesPaths: string[] =await TiffTilerService.getAllNewestImagesPaths();
      console.log(newestImagesPaths);
      const config: any = require("../../config/project.config.json");
      const outputTilesDir: string = config["sentinelImage"]["outputTilesDir"];
      for (let imagePath of newestImagesPaths) {
        await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imagePath, outputTilesDir);
      }
    } catch(err) {
      throw err;
    }
  }


  static async usePythonCommandLineToSplitJpgToTiff(tiffImagePath: string, outputTilesDir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let pythonCodePath: string =path.resolve(`${__dirname}/../../pythonscript`);

      let options: any = {
        scriptPath: pythonCodePath,
        args: ["-z", "0-5", tiffImagePath, outputTilesDir]
      };


      PythonShell.run("tifftiler.py", options,  (err: Error) => {
        if (err){
          console.log(err);
          reject(new Error("PYTHON_RUN_ERROR"));
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
  static async getAllNewestImagesPaths(): Promise<string[]> {
    let allSquareFoldersPathInS3: string[] = await TiffTilerService.getAllSquareFoldersPathInS3ForGdal_();
      console.log(allSquareFoldersPathInS3);
    let allSquareNewestImagesFolderPathArray : string[] = await TiffTilerService.getAllSquareNewestImagesFolderPath_(allSquareFoldersPathInS3);
      console.log(allSquareFoldersPathInS3);
    let allNewestImagesPathArray: string[] = [];
    for (let eachNewestFolder of allSquareNewestImagesFolderPathArray) {
      let files: string [] =  await TiffTilerService.getFolderAllImagePath_(eachNewestFolder);
      allNewestImagesPathArray.push(...files);
    }
      console.log(allNewestImagesPathArray);
    return allNewestImagesPathArray;
  }


  /**
   * The files folder in sentinel-2 s3 is tiles/[UTM code]/latitude band/square/[year]/[month]/[day]/[sequence]/DATA
   * Find all images in newest day paths 
   * 
   * @private
   * @static
   * @returns {string[]} 
   * 
   * @memberOf TiffTilerService
   */
  private static async getAllSquareFoldersPathInS3ForGdal_(): Promise<string[]> {
    const config: any = require("../../config/project.config.json");
    const tilesDir: string = config["sentinelImage"]["inputTilesDir"];

    let allSquareFoldersPathInS3: string[] = [];
    let utmCodeFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(tilesDir);
    console.log(utmCodeFolderNameArray)
    for (let eachUtmCodeFolderName of utmCodeFolderNameArray) {
      let latitudeBandFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(tilesDir + "/" + eachUtmCodeFolderName);
    console.log(latitudeBandFolderNameArray)
      for (let eachLatitudeBandFolderName of latitudeBandFolderNameArray) {
        let squareFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(tilesDir + "/" + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName);
    console.log(squareFolderNameArray)
        for (let eachName of squareFolderNameArray) {
          allSquareFoldersPathInS3.push(tilesDir + "/" + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName);
        }
      }
    }
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
            fs.stat(parentPath + "/" +eachDir, (err: Error, stats: fs.Stats) => {
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
            fs.stat(parentPath + "/" +eachFile, (err: Error, stats: fs.Stats) => {
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
