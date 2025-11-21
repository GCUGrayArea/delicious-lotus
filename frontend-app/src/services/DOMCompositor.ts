/**
 * DOMCompositor - DOM-based layer system for rendering overlays
 *
 * Manages absolutely positioned div layers for rendering images, text,
 * and graphics overlays on top of video with efficient DOM node reuse
 */

import type { Clip, MediaAsset } from '../types/stores'
import type { ActiveClip } from './ClipResolver'

export interface LayerNode {
  id: string
  element: HTMLDivElement
  clipId: string
  lastUpdate: number
}

export interface CompositorOptions {
  containerElement: HTMLElement
  maxLayers?: number // Maximum number of reusable layer nodes
}

export class DOMCompositor {
  private container: HTMLElement
  private layerPool: LayerNode[] = []
  private activeLayers: Map<string, LayerNode> = new Map()
  private maxLayers: number
  private assetCache: Map<string, MediaAsset> = new Map()

  constructor(options: CompositorOptions) {
    this.container = options.containerElement
    this.maxLayers = options.maxLayers ?? 20

    this.initializeContainer()
  }

  /**
   * Initialize the container for compositing
   */
  private initializeContainer(): void {
    // Ensure container has proper positioning
    if (this.container.style.position === '' || this.container.style.position === 'static') {
      this.container.style.position = 'relative'
    }
  }

  /**
   * Create a new layer element
   */
  private createLayerElement(): HTMLDivElement {
    const layer = document.createElement('div')

    // Base layer styles
    layer.style.position = 'absolute'
    layer.style.top = '0'
    layer.style.left = '0'
    layer.style.transformOrigin = 'center center'
    layer.style.pointerEvents = 'none'
    layer.style.willChange = 'transform, opacity'

    return layer
  }

  /**
   * Get or create a layer node for a clip
   */
  private getLayerNode(clipId: string): LayerNode {
    // Check if layer already exists
    let layerNode = this.activeLayers.get(clipId)
    if (layerNode) {
      layerNode.lastUpdate = Date.now()
      return layerNode
    }

    // Try to reuse from pool
    if (this.layerPool.length > 0) {
      layerNode = this.layerPool.pop()!
      layerNode.clipId = clipId
      layerNode.lastUpdate = Date.now()
      this.activeLayers.set(clipId, layerNode)
      return layerNode
    }

    // Create new layer
    const element = this.createLayerElement()
    layerNode = {
      id: `layer-${Date.now()}-${Math.random()}`,
      element,
      clipId,
      lastUpdate: Date.now(),
    }

    this.container.appendChild(element)
    this.activeLayers.set(clipId, layerNode)

    return layerNode
  }

  /**
   * Render overlay clips as DOM layers
   */
  renderOverlays(
    overlayClips: ActiveClip[],
    assets: Map<string, MediaAsset>,
    containerWidth: number,
    containerHeight: number
  ): void {
    // Cache assets
    assets.forEach((asset, id) => this.assetCache.set(id, asset))

    // Track which clips are currently active
    const activeClipIds = new Set(overlayClips.map((clip) => clip.id))

    // Remove layers for clips that are no longer active
    this.activeLayers.forEach((layerNode, clipId) => {
      if (!activeClipIds.has(clipId)) {
        this.recycleLayer(clipId)
      }
    })

    // Render each overlay clip
    overlayClips.forEach((clip, index) => {
      const asset = assets.get(clip.assetId)
      if (!asset) return

      const layerNode = this.getLayerNode(clip.id)

      // Update layer content and styling
      this.updateLayer(layerNode, clip, asset, containerWidth, containerHeight, index)
    })
  }

  /**
   * Update a layer's content and styling
   */
  private updateLayer(
    layerNode: LayerNode,
    clip: Clip,
    asset: MediaAsset,
    containerWidth: number,
    containerHeight: number,
    zIndex: number
  ): void {
    const { element } = layerNode

    // Set z-index based on track order
    element.style.zIndex = `${zIndex + 100}` // Offset to ensure above video

    // Update content based on asset type
    if (asset.type === 'image') {
      this.renderImageLayer(element, asset, clip)
    } else if (asset.type === 'video') {
      // Video overlays would use video element (not implemented here)
      // For now, show placeholder
      this.renderPlaceholderLayer(element, 'Video Overlay')
    } else {
      // Text or other types
      this.renderTextLayer(element, asset)
    }

    // Apply transforms (will be enhanced by TransformEngine)
    const transform = this.calculateTransform(clip, containerWidth, containerHeight)
    element.style.transform = transform
    element.style.opacity = clip.opacity.toString()

    // Set size and position
    this.applyDimensions(element, clip, asset, containerWidth, containerHeight)
  }

  /**
   * Render an image layer
   */
  private renderImageLayer(element: HTMLDivElement, asset: MediaAsset, _clip: Clip): void {
    // Check if we need to update the image
    const existingImg = element.querySelector('img')
    if (existingImg && existingImg.src === asset.url) {
      return // Image already loaded
    }

    // Clear existing content
    element.innerHTML = ''

    // Create image element
    const img = document.createElement('img')
    img.src = asset.url
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.objectFit = 'contain'
    img.style.pointerEvents = 'none'
    img.draggable = false

    element.appendChild(img)
  }

  /**
   * Render a text layer
   */
  private renderTextLayer(element: HTMLDivElement, asset: MediaAsset): void {
    element.innerHTML = ''

    const textDiv = document.createElement('div')
    textDiv.textContent = asset.name // For now, just display asset name
    textDiv.style.color = 'white'
    textDiv.style.fontSize = '24px'
    textDiv.style.fontWeight = 'bold'
    textDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)'
    textDiv.style.padding = '10px'
    textDiv.style.whiteSpace = 'nowrap'

    element.appendChild(textDiv)
  }

  /**
   * Render a placeholder layer
   */
  private renderPlaceholderLayer(element: HTMLDivElement, label: string): void {
    element.innerHTML = ''

    const placeholder = document.createElement('div')
    placeholder.textContent = label
    placeholder.style.color = 'white'
    placeholder.style.backgroundColor = 'rgba(0,0,0,0.5)'
    placeholder.style.padding = '20px'
    placeholder.style.borderRadius = '8px'
    placeholder.style.fontSize = '16px'

    element.appendChild(placeholder)
  }

  /**
   * Calculate CSS transform string from clip properties
   */
  private calculateTransform(
    clip: Clip,
    containerWidth: number,
    containerHeight: number
  ): string {
    const transforms: string[] = []

    // Translate (position)
    if (clip.position) {
      const x = clip.position.x * containerWidth
      const y = clip.position.y * containerHeight
      transforms.push(`translate(${x}px, ${y}px)`)
    }

    // Scale
    if (clip.scale) {
      transforms.push(`scale(${clip.scale.x}, ${clip.scale.y})`)
    }

    // Rotate
    if (clip.rotation) {
      transforms.push(`rotate(${clip.rotation}deg)`)
    }

    return transforms.join(' ')
  }

  /**
   * Apply dimensions to layer element
   */
  private applyDimensions(
    element: HTMLDivElement,
    clip: Clip,
    asset: MediaAsset,
    containerWidth: number,
    containerHeight: number
  ): void {
    // Default to asset dimensions or container size
    let width = asset.width ?? containerWidth
    let height = asset.height ?? containerHeight

    // Apply scale from clip
    if (clip.scale) {
      width *= clip.scale.x
      height *= clip.scale.y
    }

    element.style.width = `${width}px`
    element.style.height = `${height}px`
  }

  /**
   * Recycle a layer node back to the pool
   */
  private recycleLayer(clipId: string): void {
    const layerNode = this.activeLayers.get(clipId)
    if (!layerNode) return

    // Clear content
    layerNode.element.innerHTML = ''

    // Reset styles
    layerNode.element.style.transform = ''
    layerNode.element.style.opacity = '1'
    layerNode.element.style.zIndex = '0'

    // Remove from active and add to pool
    this.activeLayers.delete(clipId)

    if (this.layerPool.length < this.maxLayers) {
      this.layerPool.push(layerNode)
    } else {
      // Pool is full, remove element from DOM
      layerNode.element.remove()
    }
  }

  /**
   * Clear all layers
   */
  clearLayers(): void {
    this.activeLayers.forEach((layerNode, clipId) => {
      this.recycleLayer(clipId)
    })
  }

  /**
   * Update container size (call when preview size changes)
   */
  updateContainerSize(width: number, height: number): void {
    this.container.style.width = `${width}px`
    this.container.style.height = `${height}px`
  }

  /**
   * Get the container element
   */
  getContainer(): HTMLElement {
    return this.container
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clearLayers()
    this.layerPool.forEach((layerNode) => {
      layerNode.element.remove()
    })
    this.layerPool = []
    this.assetCache.clear()
  }
}
