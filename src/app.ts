import {TiffTilerService} from "./tifftiler/tifftilerservice";



TiffTilerService.saveImagePathInRedis(2017, 5, 16 , ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08"]);

// TiffTilerService.startTransformImageToTiff(8);
console.log("Server start");