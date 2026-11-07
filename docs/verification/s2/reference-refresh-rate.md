# 参考环境显示刷新率

2026-11-06，在 macOS System Settings > Displays 中选中 Built-in Display。切换前 Refresh rate 为 `ProMotion`。为执行原要求的实际 60 Hz 性能验收，在同一菜单选择 `60 Hertz`；随后重新读取显示设置，Refresh rate 显示 `60 Hertz`。未修改其他显示设置，也未使用浏览器模拟刷新率。

性能测试结束后，在同一显示设置中将 Refresh rate 恢复为原值 `ProMotion`；重新读取确认 Built-in Display 当前显示 `ProMotion`。整个切换和恢复过程中未修改其他系统设置。

第二次补测窗口：再次确认原值为 `ProMotion`，切换为 `60 Hertz` 并重新读取确认。补测完成后恢复 `ProMotion`，重新读取确认 Built-in Display 的 Refresh rate 为 `ProMotion`；未更改其他系统设置。

第三次补测窗口：为修正视口和设备像素比后的控制时序复测，确认原值为 `ProMotion`，切换为 `60 Hertz` 并重新读取确认。补测完成后恢复 `ProMotion`，重新读取确认 Built-in Display 的 Refresh rate 为 `ProMotion`；未更改其他系统设置。
