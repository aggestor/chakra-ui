import { extractPropertyPaths, printUnionMap } from "./extract-property-paths"
import {
  extractComponentTypes,
  printComponentTypes,
} from "./extract-component-types"
import { extractColorSchemeTypes } from "./extract-color-schemes"
import { extractPropertyKeys } from "./extract-property-keys"
import { formatWithPrettierIfAvailable } from "../../utils/format-with-prettier"
import { isObject } from "../../utils/is-object"

export interface ThemeKeyOptions {
  /**
   * Property key in the theme object
   * @example colors
   */
  key: string
  /**
   * Maximum extraction level
   * @example
   * union: gray.500
   * level: 1---|2--|
   * @default 3
   */
  maxScanDepth?: number
  /**
   * Pass a function to filter extracted values
   * @example
   * Exclude numeric index values from `breakpoints`
   * @default () => true
   */
  filter?: (value: string) => boolean

  /**
   * Pass a function to flatMap extracted values
   * @default value => value
   */
  flatMap?: (value: string) => string | string[]
}

export interface CreateThemeTypingsInterfaceOptions {
  config: ThemeKeyOptions[]
  strictComponentTypes?: boolean
  format?: boolean
  strictTokenTypes?: boolean
}

export async function createThemeTypingsInterface(
  theme: Record<string, unknown>,
  {
    config,
    strictComponentTypes = false,
    format = true,
    strictTokenTypes = false,
  }: CreateThemeTypingsInterfaceOptions,
) {
  const unions = config.reduce(
    (
      allUnions,
      { key, maxScanDepth, filter = () => true, flatMap = (value) => value },
    ) => {
      const target = theme[key]

      allUnions[key] = []

      if (isObject(target) || Array.isArray(target)) {
        allUnions[key] = extractPropertyPaths(target, maxScanDepth)
          .filter(filter)
          .flatMap(flatMap)
      }

      if (isObject(theme.semanticTokens)) {
        // semantic tokens do not allow nesting, we just need to extract the keys
        const semanticTokenKeys = extractPropertyKeys(theme.semanticTokens, key)
          .filter(filter)
          .flatMap(flatMap)

        allUnions[key].push(...semanticTokenKeys)
      }

      return allUnions
    },
    {} as Record<string, string[]>,
  )

  const textStyles = extractPropertyKeys(theme, "textStyles")
  const layerStyles = extractPropertyKeys(theme, "layerStyles")
  const colorSchemes = extractColorSchemeTypes(theme)
  const componentTypes = extractComponentTypes(theme)

  const template =
    // language=ts
    `// regenerate by running
// npx @chakra-ui/cli tokens path/to/your/theme.(js|ts)
import { BaseThemeTypings } from "./shared.types.js"
export interface ThemeTypings extends BaseThemeTypings {
  ${printUnionMap(
    { ...unions, textStyles, layerStyles, colorSchemes },
    strictTokenTypes,
  )}
  ${printComponentTypes(componentTypes, strictComponentTypes)}
}

`

  return format ? formatWithPrettierIfAvailable(template) : template
}
