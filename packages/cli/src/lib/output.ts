import { writeFile } from 'node:fs/promises';

/**
 * Write content to a file path, or to stdout when outputPath is undefined.
 * Ensures output ends with a newline.
 */
export async function writeOutput(content: string, outputPath: string | undefined): Promise<void> {
  if (outputPath) {
    await writeFile(outputPath, content, 'utf-8');
  } else {
    process.stdout.write(content);
    if (!content.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
}
