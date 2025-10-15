


fetch("https://mgr.k7m9x2n.com/api/v1/system/qr-dealers/reckon/configs", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        id: null,
        date: "2025-10-14",
        rateConfigs: [
          // 普通
            { speed_mode: "qq", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.1 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.11 }
            ]},
          // 加速
            { speed_mode: "fast", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.2 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.22 }
            ]},
          // 超速
            { speed_mode: "sup", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.3 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.33 }
            ]},
          // 极速
            { speed_mode: "very", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.4 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.44 }
            ]},
          // 秒拉
            { speed_mode: "ml", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.5 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.55 }
            ]},
          // 钱包直拉
            { speed_mode: "zl", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.6 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.66 }
            ]},
          // 怪额
            { speed_mode: "odd", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.7 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.77 }
            ]},
          // 超怪
            { speed_mode: "cg", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.8 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.88 }
            ]},
          // 微信单端
            { speed_mode: "wx", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.9 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.99 }
            ]},
          // 微信双端
            { speed_mode: "bz", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.91 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.911 }
            ]},
          // 微信固额
            { speed_mode: "ge", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.92 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.922 }
            ]},
          // 微信小额
            { speed_mode: "xe", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.93 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.933 }
            ]},
          // 微信扫码
            { speed_mode: "qr", time_rates: [
                { start_time: "00:00:00", end_time: "12:00:00", rate: 0.94 },
                { start_time: "12:00:00", end_time: "23:59:59", rate: 0.944 }
            ]}
        ]
    })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error("请求失败:", err));
