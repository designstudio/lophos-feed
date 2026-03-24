declare module 'float-sidebar' {
  interface FloatSidebarOptions {
    sidebar: HTMLElement
    relative: HTMLElement
    viewport?: HTMLElement | Window
    sidebarInner?: HTMLElement
    topSpacing?: number
    bottomSpacing?: number
  }

  interface FloatSidebarInstance {
    forceUpdate(): void
    destroy(): void
  }

  function FloatSidebar(options: FloatSidebarOptions): FloatSidebarInstance
  export default FloatSidebar
}
