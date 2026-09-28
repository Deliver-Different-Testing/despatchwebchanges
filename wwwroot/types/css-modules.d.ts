/**
 * CSS Module type declarations
 *
 * Allows TypeScript to understand CSS module imports.
 */
declare module '*.module.css' {
    const classes: { [key: string]: string };
    export default classes;
}

declare module '*.module.less' {
    const classes: { [key: string]: string };
    export default classes;
}

declare module '*.module.scss' {
    const classes: { [key: string]: string };
    export default classes;
}

declare module '*.css';
declare module '*.less';
declare module '*.scss';
