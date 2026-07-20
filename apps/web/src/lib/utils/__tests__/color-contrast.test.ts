import { describe, expect, it } from 'vitest'
import {
  generateAccessibleColor,
  getColorLuminance,
  getContrastRatio,
  hexToRgb,
  isAccessibleContrast,
  rgbToHsl
} from '../color-contrast'

describe('color-contrast utilities', () => {
  describe('hexToRgb', () => {
    it('should convert hex color to RGB', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb('#ff6b35')).toEqual({ r: 255, g: 107, b: 53 })
    })

    it('should handle short hex format', () => {
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('should return null for invalid hex colors', () => {
      expect(hexToRgb('invalid')).toBeNull()
      expect(hexToRgb('#gggggg')).toBeNull()
      expect(hexToRgb('')).toBeNull()
    })
  })

  describe('rgbToHsl', () => {
    it('should convert RGB to HSL', () => {
      const white = rgbToHsl(255, 255, 255)
      expect(white.h).toBe(0)
      expect(white.s).toBe(0)
      expect(white.l).toBe(100)

      const black = rgbToHsl(0, 0, 0)
      expect(black.h).toBe(0)
      expect(black.s).toBe(0)
      expect(black.l).toBe(0)
    })

    it('should handle colored values correctly', () => {
      const red = rgbToHsl(255, 0, 0)
      expect(red.h).toBe(0)
      expect(red.s).toBe(100)
      expect(red.l).toBe(50)
    })
  })

  describe('getColorLuminance', () => {
    it('should calculate luminance correctly', () => {
      expect(getColorLuminance('#ffffff')).toBeCloseTo(1, 2)
      expect(getColorLuminance('#000000')).toBeCloseTo(0, 2)
    })

    it('should handle NectarHR orange', () => {
      const luminance = getColorLuminance('#ff6b35')
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
    })
  })

  describe('getContrastRatio', () => {
    it('should calculate contrast ratio between colors', () => {
      const whiteBlackRatio = getContrastRatio('#ffffff', '#000000')
      expect(whiteBlackRatio).toBeCloseTo(21, 0)

      const sameColorRatio = getContrastRatio('#ffffff', '#ffffff')
      expect(sameColorRatio).toBeCloseTo(1, 0)
    })

    it('should handle NectarHR orange combinations', () => {
      const orangeWhiteRatio = getContrastRatio('#ff6b35', '#ffffff')
      const orangeBlackRatio = getContrastRatio('#ff6b35', '#000000')

      expect(orangeWhiteRatio).toBeGreaterThan(1)
      expect(orangeBlackRatio).toBeGreaterThan(1)
    })
  })

  describe('isAccessibleContrast', () => {
    it('should validate WCAG AA compliance', () => {
      expect(isAccessibleContrast('#ffffff', '#000000', 'AA')).toBe(true)
      expect(isAccessibleContrast('#ffffff', '#ffffff', 'AA')).toBe(false)
    })

    it('should validate WCAG AAA compliance', () => {
      expect(isAccessibleContrast('#ffffff', '#000000', 'AAA')).toBe(true)
      expect(isAccessibleContrast('#ff6b35', '#ffffff', 'AAA')).toBe(false)
    })

    it('should handle large text requirements', () => {
      const ratio = getContrastRatio('#ff6b35', '#ffffff')
      expect(isAccessibleContrast('#ff6b35', '#ffffff', 'AA', true)).toBe(ratio >= 3)
      expect(isAccessibleContrast('#ff6b35', '#ffffff', 'AA', false)).toBe(ratio >= 4.5)
    })
  })

  describe('generateAccessibleColor', () => {
    it('should generate accessible colors for light backgrounds', () => {
      const accessibleColor = generateAccessibleColor('#ffffff', 'AA')
      expect(isAccessibleContrast(accessibleColor, '#ffffff', 'AA')).toBe(true)
    })

    it('should generate accessible colors for dark backgrounds', () => {
      const accessibleColor = generateAccessibleColor('#000000', 'AA')
      expect(isAccessibleContrast(accessibleColor, '#000000', 'AA')).toBe(true)
    })

    it('should prefer darker colors for light backgrounds', () => {
      const accessibleColor = generateAccessibleColor('#ffffff', 'AA')
      const luminance = getColorLuminance(accessibleColor)
      expect(luminance).toBeLessThan(0.5)
    })

    it('should prefer lighter colors for dark backgrounds', () => {
      const accessibleColor = generateAccessibleColor('#000000', 'AA')
      const luminance = getColorLuminance(accessibleColor)
      expect(luminance).toBeGreaterThan(0.5)
    })
  })
})