declare module 'aframe';
declare const AFRAME: any;
interface Navigator { xr?: { isSessionSupported(mode:string):Promise<boolean> } }
