import DangerousGoodsClass from "../enums/dangerous-goods.enum";

type ClassNameMap = {
    [key in DangerousGoodsClass]: string;
};

const DANGEROUS_GOODS_NAMES: ClassNameMap = {
    [DangerousGoodsClass.EXPLOSIVES]: 'Explosives',
    [DangerousGoodsClass.GASES]: 'Gases',
    [DangerousGoodsClass.FLAMMABLE_LIQUID]: 'Flammable Liquid',
    [DangerousGoodsClass.FLAMMABLE_SOLID]: 'Flammable Solid',
    [DangerousGoodsClass.OXIDIZING_SUBSTANCE]: 'Oxidizing Substance',
    [DangerousGoodsClass.TOXIC_SUBSTANCE]: 'Toxic Substance',
    [DangerousGoodsClass.RADIOACTIVE]: 'Radioactive Material',
    [DangerousGoodsClass.CORROSIVE]: 'Corrosive',
    [DangerousGoodsClass.MISCELLANEOUS]: 'Miscellaneous Dangerous Goods'
};

function getDangerousGoodsClassName(
    classNumber: number | DangerousGoodsClass | null | undefined
): string {
    if (classNumber === null || classNumber === undefined) return 'Not Specified';
    return DANGEROUS_GOODS_NAMES[classNumber as DangerousGoodsClass] || 'Unknown Class';
}

export default getDangerousGoodsClassName;
