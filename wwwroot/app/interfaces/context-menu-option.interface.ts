export default interface IContextMenuOption {
    text: string | Function;
    html?: string | Function;
    click?: Function;
    enabled?: boolean | Function;
    displayed?: boolean | Function;
    hasTopDivider?: boolean | Function;
    hasBottomDivider?: boolean | Function;
    children?: IContextMenuOption[] | Function | Promise<any>;
    icon?: string;
}
