export function getVegaTimeFormatRules(lang: string) {
    switch (lang) {
        case 'zh-CN':
            return {
                dateTime: '%x %A %X',
                date: '%Y年%-m月%-d日',
                time: '%H:%M:%S',
                periods: ['上午', '下午'],
                days: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
                shortDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
                months: [
                    '一月',
                    '二月',
                    '三月',
                    '四月',
                    '五月',
                    '六月',
                    '七月',
                    '八月',
                    '九月',
                    '十月',
                    '十一月',
                    '十二月',
                ],
                shortMonths: [
                    '一月',
                    '二月',
                    '三月',
                    '四月',
                    '五月',
                    '六月',
                    '七月',
                    '八月',
                    '九月',
                    '十月',
                    '十一月',
                    '十二月',
                ],
            };
        case 'en-US':
        default:
            return {
                dateTime: '%x, %X',
                date: '%-m/%-d/%Y',
                time: '%-I:%M:%S %p',
                periods: ['AM', 'PM'],
                days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                shortDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                months: [
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                ],
                shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            };
    }
}