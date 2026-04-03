declare module 'sticky-sidebar-v2' {
  class StickySidebar {
    constructor(selector: string | HTMLElement, options?: StickySidebarOptions)
    updateSticky(): void
    destroy(): void
  }

  interface StickySidebarOptions {
    topSpacing?: number
    bottomSpacing?: number
    containerSelector?: string
    innerWrapperSelector?: string
    scrollContainer?: string
    stickyClass?: string
    minWidth?: number
  }

  export default StickySidebar
  export { StickySidebar }
}
