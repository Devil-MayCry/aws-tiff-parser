// Copyright 2017 huteng (huteng@gagogroup.com). All rights reserved.,
// Use of this source code is governed a license that can be found in the LICENSE file.

import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";

import * as cron from "cron";
import * as async from "async";
import * as child_process from "child_process";

import{RedisHelper} from "../db/redishelper";

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

  static async startTransformImageToTiff(): Promise<void> {
      while (1) {
        let imageInfoInString: string = await RedisHelper.getInstance().getImageSplitTask();
        console.log(imageInfoInString);
        if (imageInfoInString === null) {
          console.log("all image split finish, hold on for new task");
          setTimeout(2000);
        } else {
          let imageInfo: any = JSON.parse(imageInfoInString);
          console.log(imageInfo);
          await TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imageInfo, OUT_PUT_TILES_DIR, IN_PUT_TILES_DIR);
        }
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
  static async saveImagePathInRedis(year: number, month: number, day: number, zoom: number, waveArray: string[]): Promise<void> {
    try {


      let imagesInfos: WaveFile[] = await TiffTilerService.getSplitedImagesPaths(year, month, day, waveArray);

      await RedisHelper.getInstance().saveImagesPathInRedis(imagesInfos, zoom);

      // Write file path in file for emergency
      let fileSavedAllImagePath: string = OUT_PUT_TILES_DIR + `allImagePaths_${year}_${month}_${day}_${zoom}.txt`;

      const stream: fs.WriteStream = fs.createWriteStream(fileSavedAllImagePath);

      for (let imageInfo of imagesInfos) {
        stream.write(imageInfo.filePath + `\n`);
      }
      console.log("all images end");
      stream.end();



      // fs.unlinkSync(fileSavedAllImagePath);


      // async.eachLimit(imagesInfos, 3, (imageInfo, done) => {
      //   TiffTilerService.usePythonCommandLineToSplitJpgToTiff(imageInfo, outputTilesDir, inputTilesDir, maxZoom).then(() => {
      //     done();
      //   });
      // }, (err: Error) => {
      //   if (err) {
      //     console.log(err);
      //     throw(err);
      //   } else {
      //     fs.unlinkSync(fileSavedAllImagePath);
      //   }
      // });

    } catch (err) {
      throw err;
    }
  }

  static async usePythonCommandLineToSplitJpgToTiff(tiffImagePath: {filePath: string, waveType: string, maxZoom: string}, outputTilesDir: string, inputTilesDir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let pythonCodePath: string = path.resolve(`${__dirname}/../../pythonscript/tifftiler.py`);

      // 分解图片路径，获取年月日，作为输出路径
      let maxZoom: string = tiffImagePath.maxZoom;
      let filePath: string = tiffImagePath.filePath;
      let tempDir: string = "/tmp";
      console.log("start split...");

      console.log(filePath);

      let dirPath: string = filePath.replace(inputTilesDir, "");
      let dirArray: string[] = dirPath.split("/");
      let timePath = dirArray[3] + "/" + dirArray[4] + "/" + dirArray[5] + "/";
      let outputDir: string = outputTilesDir  + timePath + tiffImagePath.waveType;
      let timestamp: number = new Date().getTime();
      let copyAndRenameFile: string = `cp ${filePath} ${tempDir} \n  mv ${tempDir}/${tiffImagePath.waveType}.jp2 ${tempDir}/${timestamp}.jp2 `;
      child_process.exec(copyAndRenameFile, (error, stdout, stderr) => {
        let tempFilePath: string = `${tempDir}/${timestamp}.jp2`;
        if (!error) {
          fs.stat(outputDir, (err, stats) => {
            if (stats) {
              const process: child_process.ChildProcess = child_process.execFile("/root/miniconda3/bin/python", [pythonCodePath, "-z", `0-${maxZoom}`, tempFilePath, outputDir], (error, stdout, stderr) => {
                if (error) {
                  console.log("error");
                  resolve();
                } else {
                  console.log("split..end.");
                  child_process.exec(`rm ${tempFilePath}`);
                  resolve();
                }
              });
            } else {
              fs.mkdir(outputDir, () => {
                const process: child_process.ChildProcess = child_process.execFile("/root/miniconda3/bin/python", [pythonCodePath, "-z", `0-${maxZoom}`, tempFilePath, outputDir], (error, stdout, stderr) => {
                  if (error) {
                    console.log("error");
                    resolve();
                  } else {
                    console.log("split..end.");
                    child_process.exec(`rm ${tempFilePath}`);
                    resolve();
                  }
                });
              });
            }
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
  static async getSplitedImagesPaths(year: number, month: number, day: number, waveArray: string[]): Promise<WaveFile[]> {
    // let allSquareFoldersPathInS3: string[] = await TiffTilerService.getAllSquareFoldersPathInS3ForGdal_();


    let allChinaSquareFoldersPathInS3: string[] = await TiffTilerService.getAllSquareFoldersPathInS3ForGdal_();
    // let allChinaSquareFoldersPathInS3: string[] = ["/mountdata/s3-sentinel-2/tiles/48/T/TK/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/TL/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/TM/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/UK/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/UL/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/UM/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/UN/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/UP/",
    //                                                 "/mountdata/s3-sentinel-2/tiles/48/T/UQ/"];
    console.log(allChinaSquareFoldersPathInS3);
    let allSpecifyImagesPath: WaveFile[] =  await TiffTilerService.getAllSpecifyImagesPath_(allChinaSquareFoldersPathInS3, year, month, day, waveArray);
    return allSpecifyImagesPath;
  }

  static async getImageFiles_(rootDir: string, waveArray: string[]): Promise<WaveFile[]> {
    return new Promise<WaveFile[]>((resolve, reject) => {
      let allImages: WaveFile[] = [];
      fs.readdir(rootDir, (err: NodeJS.ErrnoException, fileNames: string[]) => {
        async.eachLimit(fileNames, 3, (fileName , done) => {
          if (fileName.endsWith(".jp2")) {
            let waveNameInArray: string[] = fileName.split(".");
            let wave: string = waveNameInArray[0];
            if (waveArray.indexOf(wave) !== -1) {
              let imageInfo: WaveFile = {filePath: rootDir + "/" + fileName, waveType: wave};
              allImages.push(imageInfo);
              done();
            } else {
              done();
            }
          } else {
            done();
          }
        }, (err: Error) => {
          if (err) {
            console.log(err);
            reject(err);
          }else {
            resolve(allImages);
          }
        });
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
      let fileSavedAllChinaSquareFoldersPath: string = outPutTilesDir + "allChinaSquareFolderPaths.txt";

      try {
        let allSquareFoldersPathInS3: string[] = [];

        // If the file is exist
        // fs.accessSync(fileSavedAllSquareFoldersPath);
        fs.accessSync( fileSavedAllChinaSquareFoldersPath);

        let lineReader: readline.ReadLine = readline.createInterface({
          input: fs.createReadStream(fileSavedAllChinaSquareFoldersPath)
        });

        lineReader.on("line", (line: any) => {
          allSquareFoldersPathInS3.push(line.toString());
        }).on("close", () => {
          resolve(allSquareFoldersPathInS3);
        });

      } catch (err) {
        // TiffTilerService.readToGetAllSquareFoldersPathInS3_(fileSavedAllSquareFoldersPath).then((allSquareFoldersPathInS3: string[]) => {
        //   resolve(allSquareFoldersPathInS3);
        // });
        TiffTilerService.readToGetChinaSquareFoldersPathInS3_(fileSavedAllChinaSquareFoldersPath).then((allSquareFoldersPathInS3: string[]) => {
          resolve(allSquareFoldersPathInS3);
        });
      }
    });
  }

  private static async readToGetChinaSquareFoldersPathInS3_(fileSavedAllSquareFoldersPath: string): Promise<string[]> {
        const config: any = require("../../config/project.config.json");
    const inputTilesDir: string = config["sentinelImage"]["inputTilesDir"];
    const stream: fs.WriteStream = fs.createWriteStream(fileSavedAllSquareFoldersPath);

    let allSquareFoldersPathInS3: string[] = [];

    let utmCodeFolderNameArray: string[] = ["48", "49", "50", "51", "52", "53", "54", "55", "56"];
    let latitudeBandFolderNameArray: string[] = ["T", "S", "R", "Q"];

    for (let eachUtmCodeFolderName of utmCodeFolderNameArray) {
      for (let eachLatitudeBandFolderName of latitudeBandFolderNameArray) {
        let squareFolderNameArray: string[] = await TiffTilerService.getAllChildFolderName_(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName);
        if (squareFolderNameArray.length > 0) {
          for (let eachName of squareFolderNameArray) {
            allSquareFoldersPathInS3.push(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/");
            console.log(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/");
            stream.write(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/" + `\n`);
          }
        }
      }
    }
    stream.end();
    return allSquareFoldersPathInS3;
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
        if (squareFolderNameArray.length > 0) {
          for (let eachName of squareFolderNameArray) {
              allSquareFoldersPathInS3.push(inputTilesDir + "/" + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/");
              // console.log(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/");
              stream.write(inputTilesDir + eachUtmCodeFolderName + "/" + eachLatitudeBandFolderName + "/" + eachName + "/" + `\n`);
          }
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
        } else {
          resolve([]);
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
  private static async getAllSpecifyImagesPath_(squareFolderPathArray: string[], year: number, month: number, day: number, waveArray: string[]): Promise<WaveFile[]> {
    return new Promise<WaveFile[]>((resolve, reject) => {
      let imagePathArray: WaveFile[] = [];

      async.map(squareFolderPathArray, (eachDir, done) => {
        let folderPath: string = eachDir + year + "/" + month + "/" + day + "/0";
        fs.stat(folderPath, (err: Error, stats: fs.Stats) => {
            console.log(folderPath);
          if (stats && stats.isDirectory()) {
              console.log("exist, done");
            TiffTilerService.getImageFiles_(folderPath, waveArray).then((data: any) => {
              imagePathArray.push(...data);
              done();
            });
          } else {
            console.log("no exist, done");
            done();
          }
        });
      }, (err: Error, values: string[]) => {
        if (err) {
          console.log("err");
          resolve([]);
        }else {
          console.log("finsih");
          console.log(imagePathArray);
          resolve(imagePathArray);
        }
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
