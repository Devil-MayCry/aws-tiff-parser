// Copyright 2017 huteng (huteng@gagogroup.com). All rights reserved.,
// Use of this source code is governed a license that can be found in the LICENSE file.

import * as fs from "fs";

import * as cron from "cron";
import * as PythonShell from "python-shell";

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
  static async startTransformImageToTiff(): Promise<void> {

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
    let allSquareNewestImagesFolderPathArray : string[] = await TiffTilerService.getAllSquareNewestImagesFolderPath_(allSquareFoldersPathInS3);
    let allNewestImagesPathArray: string[] = [];
    for (let eachNewestFolder of allSquareNewestImagesFolderPathArray) {
      let files: string [] =  await TiffTilerService.getFolderAllImagePath_(eachNewestFolder);
      allNewestImagesPathArray.push(...files);
    }
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
    let config: any = require("../../config/project.config.json");
    let tilesDir: string = config["sentinelImage"]["tilesDir"];

    let allSquareFoldersPathInS3: string[] = [];

    let utmCodeFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(tilesDir);
    for (let eachUtmCodeFolderName of utmCodeFolderNameArray) {
      let latitudeBandFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(tilesDir + eachUtmCodeFolderName);
      for (let eachLatitudeBandFolderName of latitudeBandFolderNameArray) {
        let squareFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(tilesDir + eachUtmCodeFolderName + eachLatitudeBandFolderName);
        allSquareFoldersPathInS3.push(...squareFolderNameArray);
      }
    }
    return allSquareFoldersPathInS3;
  }

  private static async getAllChildFolderName_(parentPath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(parentPath, (err: NodeJS.ErrnoException, dirNames: string[]) => {
        if (!err) {
          let childFolderArray: string[] = [];
          for(let eachDir of dirNames) {
            fs.stat(parentPath + "/" +eachDir, (err: Error, stats: fs.Stats) => {
              if (stats.isDirectory()) {
                childFolderArray.push(eachDir);
              }
            });
          }
          resolve(childFolderArray);
        }
      });
    });
  }

  private static async getFolderAllImagePath_(parentPath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(parentPath, (err: NodeJS.ErrnoException, files: string[]) => {
        if (!err) {
          let imagePathArray: string[] = [];
          for(let eachFile of files) {
            fs.stat(parentPath + "/" + eachFile, (err: Error, stats: fs.Stats) => {
              if (stats.isFile() && eachFile.endsWith(".jp2")) {
                imagePathArray.push(parentPath + "/" + eachFile);
              }
            });
          }
          resolve(imagePathArray);
        }
      });
    });
  }

  private static async getAllSquareNewestImagesFolderPath_(squareFolderPathArray: string[]): Promise<string[]> {
    let newImagesFolderPathArray: string[] = [];
    for (let eachSquareFolderPath of squareFolderPathArray) {
      let newestYear: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath);
      let newestMonth: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath + "/" + newestYear);
      let newestDay: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath + "/" + newestYear + "/" + newestMonth);
      let newestSequence: string = await TiffTilerService.findNewestChildFolderUtil_(eachSquareFolderPath + "/" + newestYear 
                                                                                    + "/" + newestMonth + "/" + newestDay);
      newImagesFolderPathArray.push(newestSequence);
    }
    return newImagesFolderPathArray;
  }

  /**
   * The child folder in square folder is /[year]/[month]/[day]/[sequence]
   * So find each child folder biggest number is the newest folder
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
            return validChildFolder[0].toString();
          }
        }
      });
    });
  };
}
