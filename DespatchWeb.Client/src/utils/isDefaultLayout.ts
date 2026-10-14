function isDefaultLayout(layoutName?: string): boolean {
    if(!layoutName) return true;
    return layoutName === 'Default';
}

export default isDefaultLayout;