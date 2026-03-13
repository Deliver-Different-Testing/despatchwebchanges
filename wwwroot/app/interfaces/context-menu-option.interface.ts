// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContextMenuCallback = (...args: any[]) => void | Promise<void>;

export default interface IContextMenuOption {
    text: string | (() => string);
    html?: string | (() => string);
    click?: ContextMenuCallback;
    enabled?: boolean | (() => boolean);
    displayed?: boolean | (() => boolean);
    hasTopDivider?: boolean | (() => boolean);
    hasBottomDivider?: boolean | (() => boolean);
    children?: IContextMenuOption[] | (() => IContextMenuOption[] | Promise<IContextMenuOption[]>) | Promise<IContextMenuOption[]>;
    icon?: string;
}
