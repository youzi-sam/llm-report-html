import { createDataEncodings } from './encodings/data.js'
import { createInteractiveEncodings } from './encodings/interactive.js'
import { createMediaEncodings } from './encodings/media.js'
import { createTextEncodings } from './encodings/text.js'

export function createEncodings(context) {
  return {
    ...createTextEncodings(context),
    ...createDataEncodings(context),
    ...createMediaEncodings(context),
    ...createInteractiveEncodings(context),
  }
}
