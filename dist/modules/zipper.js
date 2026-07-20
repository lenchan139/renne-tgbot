"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zipDirectory = zipDirectory;
const archiver_1 = __importDefault(require("archiver"));
const fs = __importStar(require("fs"));
/**
 * Create a zip archive from a directory
 */
function zipDirectory(dirPath, outputPath, progress) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 1 } }); // Fast compression
        let fileCount = 0;
        let totalSize = 0;
        archive.on('progress', (p) => {
            fileCount = p.entries.processed;
            if (progress) {
                progress.update(`📦 Zipping: ${fileCount} files processed...`);
            }
        });
        archive.pipe(output);
        // Add all files in the directory
        archive.directory(dirPath, false);
        output.on('close', () => {
            const zipSize = archive.pointer();
            resolve({ zipPath: outputPath, zipSize });
        });
        archive.on('error', reject);
        archive.finalize();
    });
}
//# sourceMappingURL=zipper.js.map