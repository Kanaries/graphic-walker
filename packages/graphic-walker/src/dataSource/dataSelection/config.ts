import { IDropdownSelectOption } from "../../components/dropdownSelect";

export const charsetOptions: IDropdownSelectOption[] = [
    {
        label: 'UTF-8',
        value: 'utf-8',
    },
    {
        label: 'UTF-16 LE',
        value: 'utf-16',
    },
    {
        label: 'UTF-16 BE',
        value: 'utf-16be',
    },
    {
        label: 'GBK/GB2312',
        value: 'gbk',
    },
    {
        label: 'Big5',
        value: 'big5',
    },
    {
        label: 'GB18030',
        value: 'gb18030',
    },
    {
        label: 'EUC-JP',
        value: 'euc-jp',
    },
    {
        label: 'ISO-2022-JP',
        value: 'iso-2022-jp',
    },
    {
        label: 'Shift JIS',
        value: 'shift-jis',
    },
    {
        label: 'EUC-KR',
        value: 'euc-kr',
    },
]

export const SUPPORTED_FILE_TYPES: IDropdownSelectOption[] = [
    {
        label: 'CSV',
        value: 'csv',
    },
    {
        label: 'JSON',
        value: 'json',
    }
]