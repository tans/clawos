# WeChat API

- Source: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412
- Retrieved: 2026-03-22
- Total items: 111
- Structure: grouped by business domain, simplified to reduce repeated content

## Reading Guide

- Each item keeps only: method, URL, request example, response example, and share link.
- `RespRef` points to a shared response block when the same payload appears repeatedly.
- `N/A` means the shared Apifox page did not expose a concrete HTTP URL.

## Common Responses

### R1 (3 APIs)

```json
{
    "code": 1,
    "data": null,
    "msg": "success"
}
```

### R2 (2 APIs)

```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "chatroomUserName": "49767299448@chatroom",
    "serverVersion": 10004,
    "newChatroomData": {
        "memberCount": 2,
        "chatRoomMember": [
            {
                "userName": "wxid1",
                "nickName": "隔壁老陈",
                "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/F3mNcrM9JiccgM56eLOzD4aiaZMibW4efYpAUMf0HuV9ricVBtdc19smEhdO26tBJ0IwqZmsANDHCf3rJVpic0NWrgPHXbiawI6vnZlV4hibibGvqb7hsTkr7fBYfO5Ss7LsksvF/0",
                "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/F3mNcrM9JiccgM56eLOzD4aiaZMibW4efYpAUMf0HuV9ricVBtdc19smEhdO26tBJ0IwqZmsANDHCf3rJVpic0NWrgPHXbiawI6vnZlV4hibibGvqb7hsTkr7fBYfO5Ss7LsksvF/132",
                "chatroomMemberFlag": 1,
                "status": 0
            },
            {
                "userName": "wxid2",
                "nickName": "不必",
                "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/UfAy94vgEmryCeyWxYAa1moicl0Tia1RnDzIDTHxxQZNKC7rjBtdRsezeL0B7sMicEicUILaxxic8QiazNlaDqRZD8vn2GrL4RIjhLuoAlfcPCPJLjQiaYe6ibn28oAdEwpsuh5W/0",
                "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/UfAy94vgEmryCeyWxYAa1moicl0Tia1RnDzIDTHxxQZNKC7rjBtdRsezeL0B7sMicEicUILaxxic8QiazNlaDqRZD8vn2GrL4RIjhLuoAlfcPCPJLjQiaYe6ibn28oAdEwpsuh5W/132",
                "chatroomMemberFlag": 1,
                "inviterUserName": "wxid_ozyqateb85un22",
                "status": 0,
                "addChatRoomSceneNewXml": "<sysmsg type="ChatRoomMemberTraceBack">
	<ChatRoomMemberTraceBack>
		<text><![CDATA[$inviter_username$邀请进群]]></text>
		<link>
			<username><![CDATA[wxid_ozyqateb85un22]]></username>
		</link>
	</ChatRoomMemberTraceBack>
</sysmsg>
"
            }
        ],
        "infoMask": 0,
        "chatRoomUserName": {},
        "watchMemberCount": 0
    },
    "chatRoomOwner": "wxid",
    "allMemberCount": 2,
    "allMemberUserNameList": [
        {
            "String": "wxid1"
        },
        {
            "String": "wxid2"
        }
    ],
    "adminCount": 0
}
```

### R3 (1 APIs)

```json
{
    "blackContactTagIdListCount": 0,
    "blackListCount": 0,
    "commentCount": 0,
    "commentUserListCount": 0,
    "createTime": 1756827024,
    "deleteFlag": 0,
    "extFlag": 0,
    "flowerFlag": 0,
    "flowerUserListCount": 0,
    "groupContactTagIdListCount": 0,
    "groupCount": 0,
    "groupUserCount": 0,
    "guideFinder": 0,
    "guideQw": 0,
    "guideTop": 0,
    "id": "14737333229654782570",
    "inTopList": 0,
    "isNotRichText": 0,
    "likeCount": 0,
    "likeFlag": 0,
    "likeUserListCount": 0,
    "msgType": "朋友圈刷新",
    "newWithTaListCount": 0,
    "nickname": "sue",
    "noChange": 0,
    "objectDesc": {
        "buffer": "PFRpbWVsaW5lT2JqZWN0PjxpZD4xNDczNzMzMzIyOTY1NDc4MjU3MDwvaWQ+PHVzZXJuYW1lPnd4aWRfZjU4ZDVhdmFlN3F0MjI8L3VzZXJuYW1lPjxjcmVhdGVUaW1lPjE3NTY4MjcwMjQ8L2NyZWF0ZVRpbWU+PGNvbnRlbnREZXNjPuS4gOWktOaer+iNiVvoi6bmtqld5oiR55yf55qE5oCl6ZyA5oqk5Y+R5Lqn5ZOB77yM57uZ5oiR5o6o6I2Q5o6o6I2Q5ZCnW+iLpua2qV08L2NvbnRlbnREZXNjPjxjb250ZW50RGVzY1Nob3dUeXBlPjA8L2NvbnRlbnREZXNjU2hvd1R5cGU+PGNvbnRlbnREZXNjU2NlbmU+MzwvY29udGVudERlc2NTY2VuZT48cHJpdmF0ZT4wPC9wcml2YXRlPjxzaWdodEZvbGRlZD4wPC9zaWdodEZvbGRlZD48c2hvd0ZsYWc+MDwvc2hvd0ZsYWc+PGFwcEluZm8+PGlkPjwvaWQ+PHZlcnNpb24+PC92ZXJzaW9uPjxhcHBOYW1lPjwvYXBwTmFtZT48aW5zdGFsbFVybD48L2luc3RhbGxVcmw+PGZyb21Vcmw+PC9mcm9tVXJsPjxpc0ZvcmNlVXBkYXRlPjA8L2lzRm9yY2VVcGRhdGU+PGlzSGlkZGVuPjA8L2lzSGlkZGVuPjwvYXBwSW5mbz48c291cmNlVXNlck5hbWU+PC9zb3VyY2VVc2VyTmFtZT48c291cmNlTmlja05hbWU+PC9zb3VyY2VOaWNrTmFtZT48cHVibGljQnJhbmRDb250YWN0VHlwZT4wPC9wdWJsaWNCcmFuZENvbnRhY3RUeXBlPjxzdGF0aXN0aWNzRGF0YT48L3N0YXRpc3RpY3NEYXRhPjxzdGF0RXh0U3RyPjwvc3RhdEV4dFN0cj48Q29udGVudE9iamVjdD48Y29udGVudFN0eWxlPjE8L2NvbnRlbnRTdHlsZT48dGl0bGU+PC90aXRsZT48ZGVzY3JpcHRpb24+PC9kZXNjcmlwdGlvbj48bWVkaWFMaXN0PjxtZWRpYT48aWQ+MTQ3MzczMzMyMzA1MDQyNjAxMzU8L2lkPjx0eXBlPjI8L3R5cGU+PHRpdGxlPjwvdGl0bGU+PGRlc2NyaXB0aW9uPuS4gOWktOaer+iNiVvoi6bmtqld5oiR55yf55qE5oCl6ZyA5oqk5Y+R5Lqn5ZOB77yM57uZ5oiR5o6o6I2Q5o6o6I2Q5ZCnW+iLpua2qV08L2Rlc2NyaXB0aW9uPjxwcml2YXRlPjA8L3ByaXZhdGU+PHVzZXJEYXRhPjwvdXNlckRhdGE+PHN1YlR5cGU+MDwvc3ViVHlwZT48dmlkZW9TaXplIHdpZHRoPSIxMjA2IiBoZWlnaHQ9IjE2MDgiPjwvdmlkZW9TaXplPjx1cmwgdHlwZT0iMSIgbWQ1PSJiMmIwYmU1MDVkODgxZDExNDVmY2EyOWJiMWE0NTY0MSIgdmlkZW9tZDU9IiIga2V5PSIxNTE3MDA2MTM4OTE5OTkyMjc4NiIgdG9rZW49IldTRU42cURzS3dWOEEwMnczb25PR1FZZnhua2liZHFTT2ttSGhaR05CNERHQm1YekVDSmtQc1dJWGNwMUVSUlBWdW9uN2VxOG9QamFjN3hDNjJRUmlhR3ciIGVuY19pZHg9IjEiPmh0dHA6Ly9zaG1tc25zLnFwaWMuY24vbW1zbnMvdk13a1N1WlBNQ2lhWnJVd2g3ampHVzIxSnZlTEtlcXZ6aWJET0lUUk5LQ3VORDE2ZldzS2dOaWI5dHBWSHpRSnJ3VlR6ekF1OTJoNWE4LzA8L3VybD48dWhkIHR5cGU9IjEiIG1kNT0iZGI4MWI0NDI5NWEzOTcxOTAwNWYzOTUwYzZkNTQxNjkiIHdpZHRoPSIxMjA2IiBoZWlnaHQ9IjE2MDgiIGZpbGVTaXplPSI3OTE4OSIga2V5PSIxNTE3MDA2MTM4OTE5OTkyMjc4NiIgdG9rZW49IldTRU42cURzS3dWOEEwMnczb25PR1FZZnhua2liZHFTT2ttSGhaR05CNERHQm1YekVDSmtQc1dJWGNwMUVSUlBWbURWWHR5RW85ZmZXbEZVcWRwTkhUQSIgZW5jX2lkeD0iMSI+aHR0cDovL3NobW1zbnMucXBpYy5jbi9tbXNucy92TXdrU3VaUE1DaWFaclV3aDdqakdXMjFKdmVMS2VxdnppYkRPSVRSTktDdU5EMTZmV3NLZ05pYjl0cFZIelFKcndWVHp6QXU5Mmg1YTgvMjAwMDwvdWhkPjxoZCB0eXBlPSIxIiBtZDU9IjQxYTAwMjU5MmE4NjE3ODlmNmUxODgxNDA3ZDgwNzBjIiB3aWR0aD0iMTIwNiIgaGVpZ2h0PSIxNjA4IiBmaWxlU2l6ZT0iNzkyMTMiIGtleT0iMTUxNzAwNjEzODkxOTk5MjI3ODYiIHRva2VuPSJXU0VONnFEc0t3VjhBMDJ3M29uT0dRWWZ4bmtpYmRxU09rbUhoWkdOQjRER0JtWHpFQ0prUHNXSVhjcDFFUlJQVlc1MHdhSXNNdDA0d29qZXNCR2ljMVhnIiBlbmNfaWR4PSIxIj5odHRwOi8vc2htbXNucy5xcGljLmNuL21tc25zL3ZNd2tTdVpQTUNpYVpyVXdoN2pqR1cyMUp2ZUxLZXF2emliRE9JVFJOS0N1TkQxNmZXc0tnTmliOXRwVkh6UUpyd1ZUenpBdTkyaDVhOC8xMDAwPC9oZD48dGh1bWIgdHlwZT0iMSIga2V5PSIxNTE3MDA2MTM4OTE5OTkyMjc4NiIgdG9rZW49IldTRU42cURzS3dWOEEwMnczb25PR1FZZnhua2liZHFTT2ttSGhaR05CNERHQm1YekVDSmtQc1dJWGNwMUVSUlBWOWlhYUp6VVZCckxvb2ZpYlU3S1ladUl3IiBlbmNfaWR4PSIxIj5odHRwOi8vc2htbXNucy5xcGljLmNuL21tc25zL3ZNd2tTdVpQTUNpYVpyVXdoN2pqR1cyMUp2ZUxLZXF2emliRE9JVFJOS0N1TkQxNmZXc0tnTmliOXRwVkh6UUpyd1ZUenpBdTkyaDVhOC8xNTA8L3RodW1iPjxzaXplIHdpZHRoPSIxMDgwLjAwMDAwMCIgaGVpZ2h0PSIxNDQwLjAwMDAwMCIgdG90YWxTaXplPSI0NjEzMyI+PC9zaXplPjwvbWVkaWE+PC9tZWRpYUxpc3Q+PGNvbnRlbnRVcmw+PC9jb250ZW50VXJsPjwvQ29udGVudE9iamVjdD48YWN0aW9uSW5mbz48YXBwTXNnPjxtZXNzYWdlQWN0aW9uPjwvbWVzc2FnZUFjdGlvbj48L2FwcE1zZz48L2FjdGlvbkluZm8+PGxvY2F0aW9uIHBvaUNsYXNzaWZ5SWQ9IiIgcG9pTmFtZT0iIiBwb2lBZGRyZXNzPSIiIHBvaUNsYXNzaWZ5VHlwZT0iMCIgY2l0eT0iIj48L2xvY2F0aW9uPjxwdWJsaWNVc2VyTmFtZT48L3B1YmxpY1VzZXJOYW1lPjxzdHJlYW12aWRlbz48c3RyZWFtdmlkZW91cmw+PC9zdHJlYW12aWRlb3VybD48c3RyZWFtdmlkZW90aHVtYnVybD48L3N0cmVhbXZpZGVvdGh1bWJ1cmw+PHN0cmVhbXZpZGVvd2VidXJsPjwvc3RyZWFtdmlkZW93ZWJ1cmw+PC9zdHJlYW12aWRlbz48L1RpbWVsaW5lT2JqZWN0Pg==",
        "iLen": 2872
    },
    "objectOperations": {
        "buffer": "CAA=",
        "iLen": 2
    },
    "objectType": 0,
    "preDownloadInfo": {
        "preDownloadNetType": 0,
        "preDownloadPercent": 0
    },
    "referId": "0",
    "snsRedEnvelops": {
        "reportId": 0,
        "reportKey": 0,
        "resourceId": 0,
        "rewardCount": 0
    },
    "username": "wxid_f58d5avae7qt22",
    "weAppInfo": {
        "appId": 0,
        "score": 0,
        "showType": 0
    },
    "weiShangFeedType": 0,
    "weiShangSellerType": 0,
    "weiShangVideoSourceType": 0,
    "withChatroomListCount": 0,
    "withTaHasOther": 0,
    "withTaListCount": 0,
    "withUserCount": 0,
    "withUserListCount": 0
}
```

### R4 (1 APIs)

```json
{
    "CompressType": 0,
    "FromUserName": "wxid_8543785438012",
    "MsgId": 1213935352,
    "ToUserName": "wxid_ozyqateb85un22",
    "TotalLen": 44041,
    "downloaded_bytes": 44041,
    "path": "d:\7878787878.jpg",
    "status": "success"
}
```

### R5 (1 APIs)

```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "labelCount": 1,
    "labelPairList": [
        {
            "labelName": "我的标签",
            "labelId": 12
        }
    ]
}
```

## Index

### ????

- `POST` 发送卡片/XML消息 - `http://127.0.0.1:19088/api/send_app_msg`
- `POST` 发送本地GIF信息 - `http://127.0.0.1:19088/api/send_emotion_msg`
- `POST` 发送链接信息_不走UI - `http://127.0.0.1:19088/api/send_xml`
- `POST` 发送文本消息 - `http://127.0.0.1:19088/api/send_text_msg`
- `POST` 发送AT消息 - `http://127.0.0.1:19088/api/send_at_text`
- `POST` 发送名片消息 - `http://127.0.0.1:19088/api/send_card_msg`
- `POST` 发送图片消息 - `http://127.0.0.1:19088/api/send_image_msg`
- `POST` cdn发送图片(无源可用做转发消息) - `http://127.0.0.1:19088/api/send_cdn_img_msg`
- `POST` 发送文件消息 - `http://127.0.0.1:19088/api/send_file_msg`
- `POST` 发送语音消息 - `http://127.0.0.1:19088/api/send_voice`
- `POST` 发送MP3语音 - `http://127.0.0.1:19088/api/send_mp3_voice`
- `POST` 发送拍一拍 - `http://127.0.0.1:19088/api/send_pat`
- `POST` 发送引用消息 - `http://192.168.3.6:19088/api/send_quote`
- `POST` 发送小程序 - `http://127.0.0.1:19088/api/send_applet_msg`
- `POST` 发送位置消息 - `http://127.0.0.1:19088/api/send_location_msg`
- `POST` 获取个人资料缓存 - `http://127.0.0.1:19088/api/get_profile_cache`
- `POST` 获取个人最新网络 - `http://127.0.0.1:19088/api/get_profile_new`
- `POST` 下载图片 - `http://127.0.0.1:19088/api/download_img`
- `POST` 下载文件 - `http://127.0.0.1:19088/api/download_file`
- `POST` 获取配置文件保存目录 - `http://127.0.0.1:19088/api/get_config_path`
- `POST` 下载视频 - `http://127.0.0.1:19088/api/download_video`
- `POST` 防撤回 - `http://127.0.0.1:19088/api/anti_revoke`
- `POST` 下载语音 - `http://127.0.0.1:19088/api/download_voice`
- `POST` cdn下载 - `http://127.0.0.1:19088/api/cdn_download`
- `POST` 更新单个用户资料 - `http://7ae708ac24f643289bd7825fb03eec6d.frp.sicuropay.com/api/update_single_profile`
- `POST` 撤回任何消息 - `http://127.0.0.1:19088/api/revoke_any`
- `POST` 获取cdn信息 - `http://127.0.0.1:19088/api/get_cdn_info`

### ????

- `POST` 修改我所在群的群昵称 - `http://127.0.0.1:19088/api/mod_chat_room_self_nick_name`
- `POST` 获取群成员列表 - `http://127.0.0.1:19088/api/get_room_members`
- `POST` 获取群详情缓存 - `http://127.0.0.1:19088/api/get_chatroom_detail_cache`
- `POST` 查询群成员信息 - `http://127.0.0.1:19088/api/get_group_member_contact`
- `POST` 创建群聊 - `http://127.0.0.1:19088/api/creat_chat_room`
- `POST` 邀请进入群聊 - `http://127.0.0.1:19088/api/invite_member_to_chat_room`
- `POST` 添加群成员40人以内 - `http://127.0.0.1:19088/api/add_member_to_chat_room`
- `POST` 添加群管理 - `http://127.0.0.1:19088/api/api/set_room_admin`
- `POST` 删除群管理 - `http://127.0.0.1:19088/api/api/del_room_admin`
- `POST` 设置群公告 - `http://127.0.0.1:19088/api/set_room_announcement_pb`
- `POST` 踢出群成员 - `http://127.0.0.1:19088/api/del_member_from_chat_room`
- `POST` 退出群聊 - `http://127.0.0.1:19088/api/quit_and_del_chat_room`
- `POST` 同意群聊邀请 - `http://127.0.0.1:19088/api/enter_room`
- `POST` 获取群详情 - `http://127.0.0.1:19088/api/get_chatroom_info`
- `POST` 保存群聊到通讯录 - `http://127.0.0.1:19088/api/save_chatroom_to_contact`
- `POST` 移除群聊通讯录 - `http://127.0.0.1:19088/api/remov_chatroom_to_contact`
- `POST` 获取群聊列表 - `http://127.0.0.1:19088/api/get_chatroom_list`
- `POST` 修改群名称 - `http://127.0.0.1:19088/api/mod_chatroom_topic`
- `POST` 获取所有群的资料(网络获取长耗时接口) - `http://127.0.0.1:19088/api/batch_getroom_contact`
- `POST` 获取所有的群资料(缓存速度极快) - `http://127.0.0.1:19088/api/batch_getroom_cache`
- `POST` 初始化群聊 - `http://127.0.0.1:19088/api/init_rooms`
- `POST` 获取群成员简要信息(获取群成员昵称接口) - `http://127.0.0.1:19088/api/get_member_nick`
- `POST` 转让群主 - `http://127.0.0.1:19088/api/transferchatroomowner`

### ??????

- `POST` 搜索微信号/手机号 - `http://127.0.0.1:19088/api/net_scene_search_contact`
- `POST` 网络查询好友资料 - `http://127.0.0.1:19088/api/get_contact`
- `POST` 获取A8key - `http://127.0.0.1:19088/api/get_a8key`
- `POST` 获取小程序code - `http://192.168.3.5:19088/api/js_login`
- `POST` 验证好友请求 - `http://127.0.0.1:19088/api/verify_friend`
- `POST` 快速查找好友资料(非常快) - `http://127.0.0.1:19088/api/get_contact_fast`
- `POST` 更新好友列表 - `http://127.0.0.1:19088/api/update_all_friend`
- `POST` 修改好友备注 - `http://127.0.0.1:19088/api/remark_contact`
- `POST` 删除好友 - `http://127.0.0.1:19088/api/del_contact`
- `POST` 获取标签列表 - `http://127.0.0.1:19088/api/get_label_lists`
- `POST` 增加标签 - `http://127.0.0.1:19088/api/add_label`
- `POST` 删除标签 - `http://127.0.0.1:19088/api/del_label`
- `POST` 修改好友标签 - `http://127.0.0.1:19088/api/modify_contact_label`
- `POST` 更新标签名字 - `http://127.0.0.1:19088/api/update_label_name`
- `POST` 获取附近人 - `http://127.0.0.1:19088/api/get_lbs_friend`
- `POST` 置顶好友 - `http://127.0.0.1:19088/api/set_top`
- `POST` 取消置顶 - `http://127.0.0.1:19088/api/cancel_top`
- `POST` 星标好友 - `http://127.0.0.1:19088/api/set_start`
- `POST` 取消星标 - `http://127.0.0.1:19088/api/del_start`
- `POST` 开启消息免打扰  - `http://127.0.0.1:19088/api/set_mute_user`
- `POST` 关闭消息免打扰 - `http://127.0.0.1:19088/api/del_mute_user`
- `POST` 拉黑好友 - `http://127.0.0.1:19088/api/black_user`
- `POST` 移出黑名单 - `http://127.0.0.1:19088/api/del_black_user`

### ???

- `POST` 发送朋友圈 - `http://127.0.0.1:19088/api/sns_post`
- `POST` 发送图片朋友圈 - `http://127.0.0.1:19088/api/sns_send_img`
- `POST` 删除朋友圈评论 - `http://127.0.0.1:19088/api/sns_del_comment`
- `POST` 朋友圈回复 - `http://127.0.0.1:19088/api/sns_comment_reply`
- `POST` 删除朋友圈 - `http://127.0.0.1:19088/api/sns_del`
- `POST` 获取朋友圈详情 - `http://127.0.0.1:19088/api/sns_get_detail`
- `POST` 获取朋友圈首页 - `http://127.0.0.1:19088/api/sns_get_first_page`
- `POST` 朋友圈图片上传 - `http://127.0.0.1:19089/api/sns_upload`
- `POST` 获取朋友圈下一页 - `http://127.0.0.1:19088/api/sns_get_next_page`

### ?????

- `POST` 获取登录二维码 - `http://127.0.0.1:19088/api/reflash_qrcode`
- `POST` 获取数据库句柄 - `http://127.0.0.1:19088/api/get_db_handle`
- `POST` 执行数据库查询 - `http://127.0.0.1:19088/api/sqlite3_exec`
- `POST` 微信初始化_删除当前设备_慎用 - `http://127.0.0.1:19088/api/wechat_init`
- `POST` 数据库备份  - `http://127.0.0.1:19088/api/backup_database`
- `POST` 获取登陆状态 - `http://127.0.0.1:19088/api/check_login`
- `POST` 退出登陆 - `http://127.0.0.1:19088/api/logout`

### ????

- `PUT` 个人发送文本消息回调 - N/A
- `PUT` 个人发送图片消息回调 - N/A
- `PUT` 个人发送文件/卡片/小程序/等等xml回调 - N/A
- `POST` 群聊获取A8key - N/A
- `POST` 获取好友资料(网络获取) - N/A
- `PUT` 群聊消息回调 - N/A
- `PUT` 私聊消息回调 - N/A
- `PUT` 朋友圈消息回调 - N/A
- `PUT` 聊天对象切换回调 - N/A
- `PUT` 群成员修改昵称回调 - N/A
- `PUT` 群成员进群回调 - N/A
- `PUT` 群成员退群回调 - N/A

### ??

- `POST` 获取好友二维码 - `http://127.0.0.1:19088/api/get_my_qrocde`
- `POST` 修改自己昵称 - `http://127.0.0.1:19088/api/mod_self_nick_name`
- `POST` 获取好友列表 - `http://127.0.0.1:19088/api/get_frien_lists`
- `POST` 确认收款 - `http://127.0.0.1:19088/api/ten_pay_trans_fer_confirm`
- `POST` 拒绝收款 - `http://127.0.0.1:19088/api/un_ten_pay_trans_fer_confirm`
- `POST` 修改头像 - `http://127.0.0.1:19088/api/upload_head_img`
- `POST` 修改个人签名 - `http://127.0.0.1:19088/api/mod_self_nick_signature`
- `POST` 获取群员昵称 - `http://127.0.0.1:19088/api/get_group_memeber_info`
- `POST` 二维码识别 - `http://127.0.0.1:19088/api/qrscan`
- `POST` 获取收藏列表 - `http://127.0.0.1:19088/api/get_favs`

## ????

### 发送卡片/XML消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_app_msg`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194161e0

Request example:
```json
{"content": "<appmsg appid="" sdkver=""><title>霜尘与#跟你爹的聊天记录</title><des>#年 轻人:[图片]&#x0D;&#x0A;#年轻人:[图片]&#x0D;&#x0A;</des><action>view</action><type>19</type><showtype>0</showtype><content></content><url>http://support.weixin.qq.com/cgi-bin/mmsupport-bin/readtemplate?t=page/favorite_record__w_unsupport</url><dataurl></dataurl><lowurl></lowurl><lowdataurl></lowdataurl><recorditem>&lt;recordinfo&gt;&lt;title&gt;霜尘与#年轻人的聊天记录&lt;/title&gt;&lt;desc&gt;#年轻人:[图片]&#x0D;&#x0A;#年轻人:[图片]&#x0D;&#x0A;&lt;/desc&gt;&lt;datalist count=&quot;2&quot;&gt;&lt;dataitem dataid=&quot;4e96646c705feed69d136026ce1f2a10&quot; datatype=&quot;2&quot; datasourceid=&quot;2551522912052390538&quot;&gt;&lt;messageuuid&gt;31f58b6996c6b292bff26b4190019f51_&lt;/messageuuid&gt;&lt;cdndataurl&gt;3057020100044b304902010002041e03640802032f57270204b480ac27020468172819042439396266386430352d663634332d346565382d396234342d3532633734363433373538360204059420010201000405004c55cf00&lt;/cdndataurl&gt;&lt;cdnencryver&gt;1&lt;/cdnencryver&gt;&lt;cdnthumburl&gt;3057020100044b304902010002041e03640802032f57270204b480ac27020468172819042437336434363630332d313934622d343561622d623863632d3265636330653662633065350204059420010201000405004c55cf00&lt;/cdnthumburl&gt;&lt;datafmt&gt;jpg&lt;/datafmt&gt;&lt;fullmd5&gt;a0ea895b8083b2b687bbc099ecaa1c0d&lt;/fullmd5&gt;&lt;datasize&gt;299187&lt;/datasize&gt;&lt;head256md5&gt;de5bc6f58e2351897a63eac28cb05dde&lt;/head256md5&gt;&lt;thumbfullmd5&gt;b3b410b9423e893e4f39e2cbcd4efb36&lt;/thumbfullmd5&gt;&lt;thumbsize&gt;3544&lt;/thumbsize&gt;&lt;thumbhead256md5&gt;97e74287ec5d2166bf9205f81075be88&lt;/thumbhead256md5&gt;&lt;sourcedatapath /&gt;&lt;sourcethumbpath /&gt;&lt;msgDataPath /&gt;&lt;msgThumpPath /&gt;&lt;sourcename&gt;#年轻人&lt;/sourcename&gt;&lt;sourcetime&gt;2020-04-21 11:02:04&lt;/sourcetime&gt;&lt;cdnthumbkey&gt;970d36d8cbff9bf041db4a11b87a9348&lt;/cdnthumbkey&gt;&lt;cdndatakey&gt;a64c5e7f575cdc58a57a340e32d0f8ea&lt;/cdndatakey&gt;&lt;dataitemsource&gt;&lt;fromusr&gt;wxid_mfcw4upkx6vm22&lt;/fromusr&gt;&lt;tousr&gt;wxid_ozyqateb85un22&lt;/tousr&gt;&lt;msgid&gt;2551522912052390538&lt;/msgid&gt;&lt;/dataitemsource&gt;&lt;/dataitem&gt;&lt;dataitem dataid=&quot;0d1c893e58674e9a963d9a77969367a4&quot; datatype=&quot;2&quot; datasourceid=&quot;1536673819017551849&quot;&gt;&lt;messageuuid&gt;34bf9006db0efc5fcfa4fa8a9f8de5e7_&lt;/messageuuid&gt;&lt;cdndataurl&gt;3057020100044b304902010002041e03640802032f57270204b480ac2702046817281a042461346630616134352d396563312d343035622d396138392d3462363461323337313531300204059420010201000405004c50bb00&lt;/cdndataurl&gt;&lt;cdnencryver&gt;1&lt;/cdnencryver&gt;&lt;cdnthumburl&gt;3057020100044b304902010002041e03640802032f57270204b480ac2702046817281a042432616132623239332d346536342d343531642d616634342d6239343737363437333461640204059420010201000405004c53db00&lt;/cdnthumburl&gt;&lt;datafmt&gt;jpg&lt;/datafmt&gt;&lt;fullmd5&gt;9587fc2946a1029d4924f59f249a9731&lt;/fullmd5&gt;&lt;datasize&gt;290904&lt;/datasize&gt;&lt;head256md5&gt;de5bc6f58e2351897a63eac28cb05dde&lt;/head256md5&gt;&lt;thumbfullmd5&gt;140e8bf2b466d9fd9d3ab28be71452ad&lt;/thumbfullmd5&gt;&lt;thumbsize&gt;2966&lt;/thumbsize&gt;&lt;thumbhead256md5&gt;d3c028f682e4f0add4c4e8bb7442ea20&lt;/thumbhead256md5&gt;&lt;sourcedatapath /&gt;&lt;sourcethumbpath /&gt;&lt;msgDataPath /&gt;&lt;msgThumpPath /&gt;&lt;sourcename&gt;#年轻 人&lt;/sourcename&gt;&lt;sourcetime&gt;2020-04-21 11:03:37&lt;/sourcetime&gt;&lt;cdnthumbkey&gt;fc18d9304d636050e51f462c032099df&lt;/cdnthumbkey&gt;&lt;cdndatakey&gt;ce3e39132a609ed5318127d49213f84f&lt;/cdndatakey&gt;&lt;dataitemsource&gt;&lt;fromusr&gt;wxid_mfcw4upkx6vm22&lt;/fromusr&gt;&lt;tousr&gt;wxid_ozyqateb85un22&lt;/tousr&gt;&lt;msgid&gt;1536673819017551849&lt;/msgid&gt;&lt;/dataitemsource&gt;&lt;/dataitem&gt;&lt;/datalist&gt;&lt;favusername&gt;&lt;/favusername&gt;&lt;favcreatetime&gt;0&lt;/favcreatetime&gt;&lt;/recordinfo&gt;</recorditem><thumburl></thumburl><messageaction></messageaction><laninfo></laninfo><extinfo></extinfo><sourceusername></sourceusername><sourcedisplayname></sourcedisplayname><commenturl></commenturl><appattach><totallen>0</totallen><attachid></attachid><emoticonmd5></emoticonmd5><fileext></fileext><aeskey></aeskey></appattach><webviewshared><publisherId></publisherId><publisherReqId>0</publisherReqId></webviewshared><weappinfo><pagepath></pagepath><username></username><appid></appid><appservicetype>0</appservicetype></weappinfo><websearch /></appmsg>", "type": "19", "wxid": "filehelper"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_app_msg' 
--header 'Content-Type: application/json' 
--data-raw '{"content": "<appmsg appid="" sdkver=""><title>霜尘与#跟你爹的聊天记录</title><des>#年 轻人:[图片]&#x0D;&#x0A;#年轻人:[图片]&#x0D;&#x0A;</des><action>view</action><type>19</type><showtype>0</showtype><content></content><url>http://support.weixin.qq.com/cgi-bin/mmsupport-bin/readtemplate?t=page/favorite_record__w_unsupport</url><dataurl></dataurl><lowurl></lowurl><lowdataurl></lowdataurl><recorditem>&lt;recordinfo&gt;&lt;title&gt;霜尘与#年轻人的聊天记录&lt;/title&gt;&lt;desc&gt;#年轻人:[图片]&#x0D;&#x0A;#年轻人:[图片]&#x0D;&#x0A;&lt;/desc&gt;&lt;datalist count=&quot;2&quot;&gt;&lt;dataitem dataid=&quot;4e96646c705feed69d136026ce1f2a10&quot; datatype=&quot;2&quot; datasourceid=&quot;2551522912052390538&quot;&gt;&lt;messageuuid&gt;31f58b6996c6b292bff26b4190019f51_&lt;/messageuuid&gt;&lt;cdndataurl&gt;3057020100044b304902010002041e03640802032f57270204b480ac27020468172819042439396266386430352d663634332d346565382d396234342d3532633734363433373538360204059420010201000405004c55cf00&lt;/cdndataurl&gt;&lt;cdnencryver&gt;1&lt;/cdnencryver&gt;&lt;cdnthumburl&gt;3057020100044b304902010002041e03640802032f57270204b480ac27020468172819042437336434363630332d313934622d343561622d623863632d3265636330653662633065350204059420010201000405004c55cf00&lt;/cdnthumburl&gt;&lt;datafmt&gt;jpg&lt;/datafmt&gt;&lt;fullmd5&gt;a0ea895b8083b2b687bbc099ecaa1c0d&lt;/fullmd5&gt;&lt;datasize&gt;299187&lt;/datasize&gt;&lt;head256md5&gt;de5bc6f58e2351897a63eac28cb05dde&lt;/head256md5&gt;&lt;thumbfullmd5&gt;b3b410b9423e893e4f39e2cbcd4efb36&lt;/thumbfullmd5&gt;&lt;thumbsize&gt;3544&lt;/thumbsize&gt;&lt;thumbhead256md5&gt;97e74287ec5d2166bf9205f81075be88&lt;/thumbhead256md5&gt;&lt;sourcedatapath /&gt;&lt;sourcethumbpath /&gt;&lt;msgDataPath /&gt;&lt;msgThumpPath /&gt;&lt;sourcename&gt;#年轻人&lt;/sourcename&gt;&lt;sourcetime&gt;2020-04-21 11:02:04&lt;/sourcetime&gt;&lt;cdnthumbkey&gt;970d36d8cbff9bf041db4a11b87a9348&lt;/cdnthumbkey&gt;&lt;cdndatakey&gt;a64c5e7f575cdc58a57a340e32d0f8ea&lt;/cdndatakey&gt;&lt;dataitemsource&gt;&lt;fromusr&gt;wxid_mfcw4upkx6vm22&lt;/fromusr&gt;&lt;tousr&gt;wxid_ozyqateb85un22&lt;/tousr&gt;&lt;msgid&gt;2551522912052390538&lt;/msgid&gt;&lt;/dataitemsource&gt;&lt;/dataitem&gt;&lt;dataitem dataid=&quot;0d1c893e58674e9a963d9a77969367a4&quot; datatype=&quot;2&quot; datasourceid=&quot;1536673819017551849&quot;&gt;&lt;messageuuid&gt;34bf9006db0efc5fcfa4fa8a9f8de5e7_&lt;/messageuuid&gt;&lt;cdndataurl&gt;3057020100044b304902010002041e03640802032f57270204b480ac2702046817281a042461346630616134352d396563312d343035622d396138392d3462363461323337313531300204059420010201000405004c50bb00&lt;/cdndataurl&gt;&lt;cdnencryver&gt;1&lt;/cdnencryver&gt;&lt;cdnthumburl&gt;3057020100044b304902010002041e03640802032f57270204b480ac2702046817281a042432616132623239332d346536342d343531642d616634342d6239343737363437333461640204059420010201000405004c53db00&lt;/cdnthumburl&gt;&lt;datafmt&gt;jpg&lt;/datafmt&gt;&lt;fullmd5&gt;9587fc2946a1029d4924f59f249a9731&lt;/fullmd5&gt;&lt;datasize&gt;290904&lt;/datasize&gt;&lt;head256md5&gt;de5bc6f58e2351897a63eac28cb05dde&lt;/head256md5&gt;&lt;thumbfullmd5&gt;140e8bf2b466d9fd9d3ab28be71452ad&lt;/thumbfullmd5&gt;&lt;thumbsize&gt;2966&lt;/thumbsize&gt;&lt;thumbhead256md5&gt;d3c028f682e4f0add4c4e8bb7442ea20&lt;/thumbhead256md5&gt;&lt;sourcedatapath /&gt;&lt;sourcethumbpath /&gt;&lt;msgDataPath /&gt;&lt;msgThumpPath /&gt;&lt;sourcename&gt;#年轻 人&lt;/sourcename&gt;&lt;sourcetime&gt;2020-04-21 11:03:37&lt;/sourcetime&gt;&lt;cdnthumbkey&gt;fc18d9304d636050e51f462c032099df&lt;/cdnthumbkey&gt;&lt;cdndatakey&gt;ce3e39132a609ed5318127d49213f84f&lt;/cdndatakey&gt;&lt;dataitemsource&gt;&lt;fromusr&gt;wxid_mfcw4upkx6vm22&lt;/fromusr&gt;&lt;tousr&gt;wxid_ozyqateb85un22&lt;/tousr&gt;&lt;msgid&gt;1536673819017551849&lt;/msgid&gt;&lt;/dataitemsource&gt;&lt;/dataitem&gt;&lt;/datalist&gt;&lt;favusername&gt;&lt;/favusername&gt;&lt;favcreatetime&gt;0&lt;/favcreatetime&gt;&lt;/recordinfo&gt;</recorditem><thumburl></thumburl><messageaction></messageaction><laninfo></laninfo><extinfo></extinfo><sourceusername></sourceusername><sourcedisplayname></sourcedisplayname><commenturl></commenturl><appattach><totallen>0</totallen><attachid></attachid><emoticonmd5></emoticonmd5><fileext></fileext><aeskey></aeskey></appattach><webviewshared><publisherId></publisherId><publisherReqId>0</publisherReqId></webviewshared><weappinfo><pagepath></pagepath><username></username><appid></appid><appservicetype>0</appservicetype></weappinfo><websearch /></appmsg>", "type": "19", "wxid": "filehelper"}'
```

### 发送本地GIF信息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_emotion_msg`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194162e0

Request example:
```json
{
    "wxid": "75",
    "filepath": "/var/tmp"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_emotion_msg' 
--header 'Content-Type: application/json' 
--data-raw '{
    "wxid": "75",
    "filepath": "/var/tmp"
}'
```

### 发送链接信息_不走UI
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_xml`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194163e0

Request example:
```json
{
    "wxid": "63",
    "title": "由于向下更加全啊",
    "description": "再业最到。难族开常因团象后也。可命保口。行几布族道市打传段程。实看属处总义合色强明。们第运一型加始。周学金会劳。",
    "thumbUrl": "https://gleaming-nougat.org/",
    "url": "https://soggy-daddy.org/"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_xml' 
--header 'Content-Type: application/json' 
--data-raw '{
    "wxid": "63",
    "title": "由于向下更加全啊",
    "description": "再业最到。难族开常因团象后也。可命保口。行几布族道市打传段程。实看属处总义合色强明。们第运一型加始。周学金会劳。",
    "thumbUrl": "https://gleaming-nougat.org/",
    "url": "https://soggy-daddy.org/"
}'
```

### 发送文本消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_text_msg`
- Content-Type: `application/json`
- RespRef: `R1`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194164e0

Request example:
```json
{"wxid":"45220347292@chatroom","msg":"6666666666"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_text_msg' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"45220347292@chatroom","msg":"6666666666"}'
```

### 发送AT消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_at_text`
- Content-Type: `application/json`
- RespRef: `R1`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194165e0

Request example:
```json
{"wxids":"notify@all","msg":"@爱吃香菜 123123","roomId":"48520920817@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_at_text' 
--header 'Content-Type: application/json' 
--data-raw '{"wxids":"notify@all","msg":"@爱吃香菜 123123","roomId":"48520920817@chatroom"}'
```

### 发送名片消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_card_msg`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194166e0

Request example:
```json
{"towxid":"filehelper","fromwxid":"wxid_8543785438012"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_card_msg' 
--header 'Content-Type: application/json' 
--data-raw '{"towxid":"filehelper","fromwxid":"wxid_8543785438012"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "count": 1,
    "list": [
        {
            "ret": 0,
            "toUserName": {
                "String": "filehelper"
            },
            "msgId": 0,
            "clientMsgId": 533085137,
            "createTime": 1756728024,
            "serverTime": 1756728030,
            "type": 42,
            "newMsgId": "6369419172447763745"
        }
    ],
    "actionFlag": 0
}
```

### 发送图片消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_image_msg`
- Content-Type: `application/json`
- RespRef: `R1`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194167e0

Request example:
```json
{"wxid":"50210378945@chatroom","filepath":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADE6YVjAAAAAXNSR0IArs4c6QAAAcNJREFUSEu9lTtLA0EQx2dyFpY2amlSCYJ+hDywNSDYXDoDFnb5AAqJoB/Azi6xyjWCcLZyl5SWCoKVl1JtLG2SlVlyybqP270gWbhm53Z+8/jPLsISFi6BAbkg9aF/TEGxMSQrAMl9LUhcgrRCuGOGbQAoKg4RYgB2G5aDXhYsE1IfNiJgULVGixB7Y9Y0ZWaEOAPSCDJAWsjBwG8jYEfOYGN1nW99/nxpk2PAOg+V4EI2KpDDyC+OC/gu/kjO9zfL0Ng6mm33R3dAn7y8CSvJZVMguiyu9s5hd21HcUgZnTy1/u4ja8pCsEIog9b2qbH3Z8+X8PL9Orcz1gurQVM8oEDkhhOAQKallA0hDsv9Wi4I9UHshQx7/BjC9dvNfNsJEvtdQOSTTYt6QT0xLblcOoVpysUnvCs6NTWeekEQcTlB6EB90CAJz64RWcKkKiqTRsJJWOmXrHNCP5iG0VizqcF5GFNHi1wrsqpSX9kXpFQ2YyYaRWVKWDROr5hIe83Pw1TmwqknOUDaRueGcCFEfhULXNbiw+UEoPPWlzGNaqo4GlICJd6E1f7t+RVT5xl5ULQ9twuVyzYfNrtzuWyOsuy/L17DGkVC6sUAAAAASUVORK5CYII="}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_image_msg' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"50210378945@chatroom","filepath":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADE6YVjAAAAAXNSR0IArs4c6QAAAcNJREFUSEu9lTtLA0EQx2dyFpY2amlSCYJ+hDywNSDYXDoDFnb5AAqJoB/Azi6xyjWCcLZyl5SWCoKVl1JtLG2SlVlyybqP270gWbhm53Z+8/jPLsISFi6BAbkg9aF/TEGxMSQrAMl9LUhcgrRCuGOGbQAoKg4RYgB2G5aDXhYsE1IfNiJgULVGixB7Y9Y0ZWaEOAPSCDJAWsjBwG8jYEfOYGN1nW99/nxpk2PAOg+V4EI2KpDDyC+OC/gu/kjO9zfL0Ng6mm33R3dAn7y8CSvJZVMguiyu9s5hd21HcUgZnTy1/u4ja8pCsEIog9b2qbH3Z8+X8PL9Orcz1gurQVM8oEDkhhOAQKallA0hDsv9Wi4I9UHshQx7/BjC9dvNfNsJEvtdQOSTTYt6QT0xLblcOoVpysUnvCs6NTWeekEQcTlB6EB90CAJz64RWcKkKiqTRsJJWOmXrHNCP5iG0VizqcF5GFNHi1wrsqpSX9kXpFQ2YyYaRWVKWDROr5hIe83Pw1TmwqknOUDaRueGcCFEfhULXNbiw+UEoPPWlzGNaqo4GlICJd6E1f7t+RVT5xl5ULQ9twuVyzYfNrtzuWyOsuy/L17DGkVC6sUAAAAASUVORK5CYII="}'
```

### cdn发送图片(无源可用做转发消息)
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_cdn_img_msg`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194168e0

Request example:
```json
{"toWxid":"filehelper","totalLen":"84942","fileId":"3057020100044b30490201000204cae5c70b02032f57ed02049288e672020464e6df94042464356537633036352d313734392d343432372d393036632d3161336565323835313531390204012818020201000405004c543d00","aesky":"1b48433cbab0884878b14f030c324b05","cdnmidImgSize":"558950","cdnthumbImgSize":"6591","encryVer":"1"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_cdn_img_msg' 
--header 'Content-Type: application/json' 
--data-raw '{"toWxid":"filehelper","totalLen":"84942","fileId":"3057020100044b30490201000204cae5c70b02032f57ed02049288e672020464e6df94042464356537633036352d313734392d343432372d393036632d3161336565323835313531390204012818020201000405004c543d00","aesky":"1b48433cbab0884878b14f030c324b05","cdnmidImgSize":"558950","cdnthumbImgSize":"6591","encryVer":"1"}'
```

### 发送文件消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_file_msg`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194169e0

Request example:
```json
{
    "wxid": "48520920817@chatroom",
    "filepath": "D:\谷歌浏览器下载\SteamSetup.exe"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_file_msg' 
--header 'Content-Type: application/json' 
--data-raw '{
    "wxid": "48520920817@chatroom",
    "filepath": "D:\谷歌浏览器下载\SteamSetup.exe"
}'
```

Response example:
```json
{
    "code": 1,
    "data": null,
    "info": "请勿使用二手贩子贩卖的成品,售后无人处理 请联系作者购买",
    "msg": "success"
}
```

### 发送语音消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_voice`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194170e0

Request example:
```json
{"toWxid":"wxid_n629zjvs2ath29","silkPath":"E:\project_java\wechat_ai_english_evaluation\voice\SILK_202512230312900.silk"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_voice' 
--header 'Content-Type: application/json' 
--data-raw '{"toWxid":"wxid_n629zjvs2ath29","silkPath":"E:\project_java\wechat_ai_english_evaluation\voice\SILK_202512230312900.silk"}'
```

Response example:
```json
{
    "toUserName": "wxid_8543785438012",
    "offset": 0,
    "length": 10483,
    "createTime": 1755645384,
    "clientMsgId": "JzAxzrj5BlDIC8omNElOfPrcDFK4QBopDYq422FMFtDYFvorepassuL9Ky",
    "msgId": 0,
    "voiceLength": 5000,
    "endFlag": 1,
    "baseResponse": {
        "ret": -2,
        "errMsg": {}
    },
    "cancelFlag": 0,
    "newMsgId": "8047442179716189588",
    "actionFlag": 0
}
```

### 发送MP3语音
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_mp3_voice`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194171e0

Request example:
```json
{
    "wxid": "wxid_n629zjvs2ath29",
    "mp3Path": "E:\project_java\wechat_ai_english_evaluation\voice\output.mp3"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_mp3_voice' 
--header 'Content-Type: application/json' 
--data-raw '{
    "wxid": "wxid_n629zjvs2ath29",
    "mp3Path": "E:\project_java\wechat_ai_english_evaluation\voice\output.mp3"
}'
```

### 发送拍一拍
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_pat`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194172e0

Request example:
```json
{"roomId":"群聊的话填写群聊个人的话 填写个人","wxid":"填写你要拍的人"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_pat' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"群聊的话填写群聊个人的话 填写个人","wxid":"填写你要拍的人"}'
```

### 发送引用消息
- Method: `POST`
- URL: `http://192.168.3.6:19088/api/send_quote`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194173e0

Request example:
```json
{"reply":"1","referContent":"1","fromUsr":"wxid_n629zjvs2ath29","newmsgid":"3931166677406054178","createTime":0,"sendto":"wxid_bdk9jdwumfgj22","msgSource":""}
```

cURL:
```bash
curl --location --request POST 'http://192.168.3.6:19088/api/send_quote' 
--header 'Content-Type: application/json' 
--data-raw '{"reply":"1","referContent":"1","fromUsr":"wxid_n629zjvs2ath29","newmsgid":"3931166677406054178","createTime":0,"sendto":"wxid_bdk9jdwumfgj22","msgSource":""}'
```

Response example:
```json
{
    "account_wxid": "wxid_8543785438012",
    "data": {
        "actionFlag": 0,
        "baseResponse": {
            "errMsg": {},
            "ret": 0
        },
        "clientMsgId": "NAQonGUnnCOF5CfFWKLu4cIgyins5GMZ",
        "createTime": 1761396536,
        "fromUserName": "wxid_8543785438012",
        "msgId": 832912929,
        "msgSource": "<msgsource>
	<bizflag>0</bizflag>
	<sec_msg_node>
		<uuid>a63d06f8497204d91fe69e0c1486e5e0_</uuid>
		<risk-file-flag></risk-file-flag>
		<risk-file-md5-list></risk-file-md5-list>
	</sec_msg_node>
</msgsource>
",
        "newMsgId": "843118478561634774",
        "toUserName": "49767299448@chatroom",
        "type": 57
    },
    "errCode": 1,
    "errMsg": "请求处理成功"
}
```

### 发送小程序
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_applet_msg`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194174e0

Request example:
```json
{"content": "<appmsg appid="" sdkver="0"><title>多重爆款  满99减40</title><des>多重爆款  满99减40</des><action>view</action><type>33</type><showtype>0</showtype><content></content><url>https://mp.weixin.qq.com/mp/waerrpage?appid=wx92916b3adca84096&amp;type=upgrade&amp;upgradetype=3#wechat_redirect</url><dataurl></dataurl><lowurl></lowurl><lowdataurl></lowdataurl><recorditem></recorditem><thumburl></thumburl><messageaction></messageaction><laninfo></laninfo><md5>5aeb8bc7093630b0c4f87b12f471681a</md5><extinfo></extinfo><sourceusername>gh_2f6dc0344214@app</sourceusername><sourcedisplayname>小象超市丨原美团买菜</sourcedisplayname><commenturl></commenturl><appattach><totallen>0</totallen><attachid></attachid><emoticonmd5></emoticonmd5><fileext>jpg</fileext><filekey>29306497a7327a579a2e3631fd6d043c</filekey><cdnthumburl>3057020100044b304902010002045d270fce02032f559502041341f7df020466c2b9d5042431653266373266312d383735392d346534342d623761652d3131656439633834353164360204051408030201000405004c55cd00</cdnthumburl><aeskey>eebe704af1e02db0a03b0d621903b11a</aeskey><cdnthumbaeskey>eebe704af1e02db0a03b0d621903b11a</cdnthumbaeskey><cdnthumbmd5>5aeb8bc7093630b0c4f87b12f471681a</cdnthumbmd5><encryver>1</encryver><tpthumburl>https://wwfile.work.weixin.qq.com/cgi-bin/download?f=30680201020461305f020100020409bbe74602030f4241020452c06db4020466c171dc042466656333393662312d613464652d346163652d623935382d39323030353466393837313702010002027b5004105aeb8bc7093630b0c4f87b12f471681a0201010201000400&amp;t=396251A1439A2C5A4AF1FD8CC9B4425C2D4AFC4A5AB72C74A3205E4FC37C47DEF9D0633DC78301BFDDEAB8D1C4D4D261FA00339E8F0B0E55C6F80DEFB2F439AF6D39C6A7DD10A732B091E07B6C6E47DE96721DFED273915FD38DB0B98B78798E296FC0D43ECF90E6A30D45758B3C66C4878AABD89CCEF2A6427D1222A608E142DEBA1F3286AE0D5A304391A90826330309EE1DEBD096D2A4FE2FC5C1CD5CF646173741EB74B50D61C91BDC588022103C55A6DDD08439B0FB803A52719396DE70FFBDBF69B77DE92D9B31E69547E43524F58781A449E9C1C30C18EDBA6D8E803429803C1E60AEAE28216CA8B7C59E83A6E9742F488F114BF99A6CC2453595955237E5741ED2FBF12A28E21992BF896E69&amp;p=1</tpthumburl><cdnthumblength>31563</cdnthumblength><cdnthumbheight>100</cdnthumbheight><cdnthumbwidth>100</cdnthumbwidth></appattach><webviewshared><publisherId></publisherId><publisherReqId>0</publisherReqId></webviewshared><weappinfo><pagepath>pages/index/index.html?lch=mhqWnAlezjf5NdKIyvMLoraZg_ext(854503783,1825020016853749823,1)&amp;protocol=imaicai%3A%2F%2Fwww.maicai.com%2Fweb%3Ffuture%3D1%26url%3Dhttps%253A%252F%252Fi.meituan.com%252Fawp%252Fhfe%252Fblock%252Fmaicai%252Fba21b5723f0f%252F303147%252Findex.html%253Fcube_mc_activityId%253D43589708%2526cube_mc_cubeCityId%253D2%252C33%252C16%252C7%252C4%252C1%252C208%252C6%252C3%2526cube_mc_isLimitPoi%253Dtrue%2526cube_mc_poiGroupId%253D3747%2526cube_mc_skuGroupId%253D144555%2526mc_source%253D0akaamabmadh&amp;__XGAdfRSkC=STAXe</pagepath><username>gh_2f6dc0344214@app</username><appid>wx92916b3adca84096</appid><version>11</version><type>2</type><weappiconurl>https://p0.meituan.net/travelcube/4e9525f88d7d8120257baed9632cb8b28982.png</weappiconurl><appservicetype>0</appservicetype><shareId>0_wx92916b3adca84096_25984985516128883@openim_1723953798_0</shareId></weappinfo><websearch /></appmsg>", "type": "33", "wxid": "filehelper"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_applet_msg' 
--header 'Content-Type: application/json' 
--data-raw '{"content": "<appmsg appid="" sdkver="0"><title>多重爆款  满99减40</title><des>多重爆款  满99减40</des><action>view</action><type>33</type><showtype>0</showtype><content></content><url>https://mp.weixin.qq.com/mp/waerrpage?appid=wx92916b3adca84096&amp;type=upgrade&amp;upgradetype=3#wechat_redirect</url><dataurl></dataurl><lowurl></lowurl><lowdataurl></lowdataurl><recorditem></recorditem><thumburl></thumburl><messageaction></messageaction><laninfo></laninfo><md5>5aeb8bc7093630b0c4f87b12f471681a</md5><extinfo></extinfo><sourceusername>gh_2f6dc0344214@app</sourceusername><sourcedisplayname>小象超市丨原美团买菜</sourcedisplayname><commenturl></commenturl><appattach><totallen>0</totallen><attachid></attachid><emoticonmd5></emoticonmd5><fileext>jpg</fileext><filekey>29306497a7327a579a2e3631fd6d043c</filekey><cdnthumburl>3057020100044b304902010002045d270fce02032f559502041341f7df020466c2b9d5042431653266373266312d383735392d346534342d623761652d3131656439633834353164360204051408030201000405004c55cd00</cdnthumburl><aeskey>eebe704af1e02db0a03b0d621903b11a</aeskey><cdnthumbaeskey>eebe704af1e02db0a03b0d621903b11a</cdnthumbaeskey><cdnthumbmd5>5aeb8bc7093630b0c4f87b12f471681a</cdnthumbmd5><encryver>1</encryver><tpthumburl>https://wwfile.work.weixin.qq.com/cgi-bin/download?f=30680201020461305f020100020409bbe74602030f4241020452c06db4020466c171dc042466656333393662312d613464652d346163652d623935382d39323030353466393837313702010002027b5004105aeb8bc7093630b0c4f87b12f471681a0201010201000400&amp;t=396251A1439A2C5A4AF1FD8CC9B4425C2D4AFC4A5AB72C74A3205E4FC37C47DEF9D0633DC78301BFDDEAB8D1C4D4D261FA00339E8F0B0E55C6F80DEFB2F439AF6D39C6A7DD10A732B091E07B6C6E47DE96721DFED273915FD38DB0B98B78798E296FC0D43ECF90E6A30D45758B3C66C4878AABD89CCEF2A6427D1222A608E142DEBA1F3286AE0D5A304391A90826330309EE1DEBD096D2A4FE2FC5C1CD5CF646173741EB74B50D61C91BDC588022103C55A6DDD08439B0FB803A52719396DE70FFBDBF69B77DE92D9B31E69547E43524F58781A449E9C1C30C18EDBA6D8E803429803C1E60AEAE28216CA8B7C59E83A6E9742F488F114BF99A6CC2453595955237E5741ED2FBF12A28E21992BF896E69&amp;p=1</tpthumburl><cdnthumblength>31563</cdnthumblength><cdnthumbheight>100</cdnthumbheight><cdnthumbwidth>100</cdnthumbwidth></appattach><webviewshared><publisherId></publisherId><publisherReqId>0</publisherReqId></webviewshared><weappinfo><pagepath>pages/index/index.html?lch=mhqWnAlezjf5NdKIyvMLoraZg_ext(854503783,1825020016853749823,1)&amp;protocol=imaicai%3A%2F%2Fwww.maicai.com%2Fweb%3Ffuture%3D1%26url%3Dhttps%253A%252F%252Fi.meituan.com%252Fawp%252Fhfe%252Fblock%252Fmaicai%252Fba21b5723f0f%252F303147%252Findex.html%253Fcube_mc_activityId%253D43589708%2526cube_mc_cubeCityId%253D2%252C33%252C16%252C7%252C4%252C1%252C208%252C6%252C3%2526cube_mc_isLimitPoi%253Dtrue%2526cube_mc_poiGroupId%253D3747%2526cube_mc_skuGroupId%253D144555%2526mc_source%253D0akaamabmadh&amp;__XGAdfRSkC=STAXe</pagepath><username>gh_2f6dc0344214@app</username><appid>wx92916b3adca84096</appid><version>11</version><type>2</type><weappiconurl>https://p0.meituan.net/travelcube/4e9525f88d7d8120257baed9632cb8b28982.png</weappiconurl><appservicetype>0</appservicetype><shareId>0_wx92916b3adca84096_25984985516128883@openim_1723953798_0</shareId></weappinfo><websearch /></appmsg>", "type": "33", "wxid": "filehelper"}'
```

### 发送位置消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/send_location_msg`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194175e0

Request example:
```json
{
    "wxid": "string",
    "x": "string",
    "y": "string",
    "lable": "string",
    "poiname": "string"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/send_location_msg' 
--header 'Content-Type: application/json' 
--data-raw '{
    "wxid": "string",
    "x": "string",
    "y": "string",
    "lable": "string",
    "poiname": "string"
}'
```

### 获取个人资料缓存
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_profile_cache`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194185e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_profile_cache'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "userInfo": {
        "bitFlag": 190,
        "userName": {
            "String": "你的wxid"
        },
        "nickName": {
            "String": "你的昵称"
        },
        "bindUin": 0,
        "bindEmail": {},
        "bindMobile": {
            "String": "你的手机号"
        },
        "status": 234021,
        "imgLen": 0,
        "sex": 2,
        "province": "Guangdong",
        "city": "Zhuhai",
        "signature": "随便记住我 然后把我忘了吧",
        "personalCard": 1,
        "disturbSetting": {
            "nightSetting": 0,
            "nightTime": {
                "beginTime": 0,
                "endTime": 0
            },
            "allDaySetting": 0,
            "allDayTime": {
                "beginTime": 0,
                "endTime": 0
            }
        },
        "pluginFlag": 16939169,
        "verifyFlag": 0,
        "point": 325,
        "experience": 1476,
        "level": 5,
        "levelLowExp": 1401,
        "levelHighExp": 2000,
        "pluginSwitch": 41984,
        "gmailList": {
            "count": 0
        },
        "alias": "hbbhcds",
        "weiboFlag": 0,
        "faceBookFlag": 0,
        "fbuserId": "0",
        "albumStyle": 0,
        "albumFlag": 0,
        "txnewsCategory": 0,
        "country": "CN"
    },
    "userInfoExt": {
        "snsUserInfo": {
            "snsFlag": 1,
            "snsBgimgId": "http://shmmsns.qpic.cn/mmsns/VT6V5OXuTMxYhxJetaAnqELiclpwsucyHFO7656Ds1ztTH25ZhuUvUibwNFLL2LBlha5rVp4picviaY/0",
            "snsBgobjectId": "13647912401971261663",
            "snsFlagEx": 7297,
            "snsPrivacyRecent": 72
        },
        "myBrandList": "",
        "bigChatRoomSize": 0,
        "bigChatRoomQuota": 0,
        "bigChatRoomInvite": 0,
        "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/YbDSeSCFxQTo42ZYic6kLk6OYqKSUDZ0qfwwdbcNrk0uc4jh1gDRibBhHrlS67UKB7ibIickhoNWdQ6lGQfMkVyWXY1LFUEC0eUf9xGBptHhAoh7Yl7CsrTJQnZ8nlM0R58c/0",
        "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/YbDSeSCFxQTo42ZYic6kLk6OYqKSUDZ0qfwwdbcNrk0uc4jh1gDRibBhHrlS67UKB7ibIickhoNWdQ6lGQfMkVyWXY1LFUEC0eUf9xGBptHhAoh7Yl7CsrTJQnZ8nlM0R58c/132",
        "mainAcctType": 0,
        "extXml": {},
        "safeDeviceList": {
            "count": 5,
            "list": [
                {
                    "name": "Android设备",
                    "uuid": "1111111111",
                    "deviceType": "android-33",
                    "createTime": 1666420216
                },
                {
                    "name": "Xiaomi-2211133C",
                    "uuid": "22222222222222",
                    "deviceType": "android-33",
                    "createTime": 1675040523
                },
                {
                    "name": "Android设备",
                    "uuid": "333333333333333",
                    "deviceType": "android-31",
                    "createTime": 1663583545
                },
                {
                    "name": "Android设备",
                    "uuid": "75b09ca7575973e839a5feb8e18b215b",
                    "deviceType": "android-31",
                    "createTime": 1652170129
                },
                {
                    "name": "Xiaomi-MI 9",
                    "uuid": "444444444444",
                    "deviceType": "android-30",
                    "createTime": 1651548607
                }
            ]
        },
        "safeDevice": 0,
        "grayscaleFlag": 359,
        "regCountry": "CN",
        "linkedinContactItem": {},
        "patternLockInfo": {
            "patternVersion": 7,
            "sign": {
                "iLen": 156,
                "buffer": "66666666666666"
            },
            "lockStatus": 0
        },
        "payWalletType": 0,
        "walletRegion": 1,
        "extStatus": "563500112150534",
        "userStatus": 1,
        "paySetting": "1",
        "patSuffix": "的钱包说请你吃饭",
        "patSuffixVersion": 2,
        "teenagerModeFinderSetting": 1,
        "teenagerModeBizAcctSetting": 0,
        "teenagerModeMiniProgramSetting": 0,
        "xagreementInfo": {
            "funcsSwitch": "0",
            "funcsUserChoiceSwitch": "0"
        },
        "salt": "888888888888888888",
        "finderSetting": "0",
        "ringBackSetting": {
            "finderObjectId": "0",
            "startTs": 0,
            "endTs": 0
        },
        "smcryptoFlag": 0,
        "globalRingBackSetting": {
            "type": 0,
            "startTime": 0,
            "endTime": 0,
            "music": {
                "sid": 0
            },
            "finder": {
                "finderObjectId": "0"
            }
        },
        "newcomeMsgDefaultVoiceNumber": 0,
        "discoveryPageCtrlFlag": "1",
        "extStatus2": "128",
        "finderLiveAliasSync": {
            "updateTime": "0",
            "spamFlag": 0,
            "deleteTime": "0"
        },
        "liveAliasRoleType": 1,
        "verifyContentList": {
            "count": 0
        },
        "lqtversion": 0,
        "teenagerModeEmotionSetting": 0,
        "notificationBannerDisplayContentSetting": 0
    }
}
```

### 获取个人最新网络
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_profile_new`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194199e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_profile_new'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "userInfo": {
        "bitFlag": 190,
        "userName": {
            "String": "你的wxid"
        },
        "nickName": {
            "String": "隔壁老陈"
        },
        "bindUin": 0,
        "bindEmail": {},
        "bindMobile": {
            "String": "电话"
        },
        "status": 234021,
        "imgLen": 0,
        "sex": 2,
        "province": "省份",
        "city": "城市",
        "signature": "随便记住我 然后把我忘了吧",
        "personalCard": 1,
        "disturbSetting": {
            "nightSetting": 0,
            "nightTime": {
                "beginTime": 0,
                "endTime": 0
            },
            "allDaySetting": 0,
            "allDayTime": {
                "beginTime": 0,
                "endTime": 0
            }
        },
        "pluginFlag": 16939169,
        "verifyFlag": 0,
        "point": 478,
        "experience": 62,
        "level": 1,
        "levelLowExp": 0,
        "levelHighExp": 200,
        "pluginSwitch": 41984,
        "gmailList": {
            "count": 0
        },
        "alias": "hbbhcds",
        "weiboFlag": 0,
        "faceBookFlag": 0,
        "fbuserId": "0",
        "albumStyle": 0,
        "albumFlag": 0,
        "txnewsCategory": 0,
        "country": "CN"
    },
    "userInfoExt": {
        "snsUserInfo": {
            "snsFlag": 1,
            "snsBgimgId": "http://shmmsns.qpic.cn/mmsns/VT6V5OXuTMxYhxJetaAnqELiclpwsucyHFO7656Ds1ztTH25ZhuUvUibwNFLL2LBlha5rVp4picviaY/0",
            "snsBgobjectId": "13647912401971261663",
            "snsFlagEx": 7297,
            "snsPrivacyRecent": 72
        },
        "myBrandList": "****",
        "bigChatRoomSize": 0,
        "bigChatRoomQuota": 0,
        "bigChatRoomInvite": 0,
        "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/YbDSeSCFxQTo42ZYic6kLk6OYqKSUDZ0qfwwdbcNrk0uc4jh1gDRibBhHrlS67UKB7ibIickhoNWdQ6lGQfMkVyWXY1LFUEC0eUf9xGBptHhAoh7Yl7CsrTJQnZ8nlM0R58c/0",
        "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/YbDSeSCFxQTo42ZYic6kLk6OYqKSUDZ0qfwwdbcNrk0uc4jh1gDRibBhHrlS67UKB7ibIickhoNWdQ6lGQfMkVyWXY1LFUEC0eUf9xGBptHhAoh7Yl7CsrTJQnZ8nlM0R58c/132",
        "mainAcctType": 0,
        "extXml": {},
        "safeDeviceList": {
            "count": 5,
            "list": [
                {
                    "name": "设备名称",
                    "uuid": "设备uuid",
                    "deviceType": "android-33",
                    "createTime": 1666420216
                }
            ]
        },
        "safeDevice": 0,
        "grayscaleFlag": 359,
        "regCountry": "CN",
        "linkedinContactItem": {},
        "patternLockInfo": {
            "patternVersion": 7,
            "sign": {
                "iLen": 156,
                "buffer": "*****"
            },
            "lockStatus": 0
        },
        "payWalletType": 0,
        "walletRegion": 1,
        "extStatus": "****",
        "userStatus": 1,
        "paySetting": "1",
        "patSuffix": "的钱包说请你吃饭",
        "patSuffixVersion": 2,
        "teenagerModeFinderSetting": 1,
        "teenagerModeBizAcctSetting": 0,
        "teenagerModeMiniProgramSetting": 0,
        "xagreementInfo": {
            "funcsSwitch": "0",
            "funcsUserChoiceSwitch": "0"
        },
        "salt": "******",
        "finderSetting": "0",
        "ringBackSetting": {
            "finderObjectId": "0",
            "startTs": 0,
            "endTs": 0
        },
        "smcryptoFlag": 0,
        "globalRingBackSetting": {
            "type": 0,
            "startTime": 0,
            "endTime": 0,
            "music": {
                "sid": 0
            },
            "finder": {
                "finderObjectId": "0"
            }
        },
        "newcomeMsgDefaultVoiceNumber": 0,
        "discoveryPageCtrlFlag": "1",
        "extStatus2": "128",
        "finderLiveAliasSync": {
            "updateTime": "0",
            "spamFlag": 0,
            "deleteTime": "0"
        },
        "liveAliasRoleType": 1,
        "verifyContentList": {
            "count": 0
        },
        "lqtversion": 0,
        "teenagerModeEmotionSetting": 0,
        "notificationBannerDisplayContentSetting": 0
    }
}
```

### 下载图片
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/download_img`
- Content-Type: `application/json`
- RespRef: `R4`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194225e0

Request example:
```json
{
    "to_user": "wxid_bdk9jdwumfgj22",
    "from_user": "wxid_n629zjvs2ath29",
    "start_pos": 0,
    "total_len": 559726,
    "data_len": 559726,
    "compress_type": 0,
    "MsgId": 1469066920,
    "path": "F:\wechat_img\7878787878.jpg"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/download_img' 
--header 'Content-Type: application/json' 
--data-raw '{
    "to_user": "wxid_bdk9jdwumfgj22",
    "from_user": "wxid_n629zjvs2ath29",
    "start_pos": 0,
    "total_len": 559726,
    "data_len": 559726,
    "compress_type": 0,
    "MsgId": 1469066920,
    "path": "F:\wechat_img\7878787878.jpg"
}'
```

### 下载文件
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/download_file`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194226e0

Request example:
```json
{"from_user":"","total_len":"31538","MsgId":2754393265637994605,"path":"d:\罗泽南8月考勤表.xlsx","attachid":"@cdn_3057020100044b3049020100020403e0b2d502032df85f020426372f70020468baeb70042439666537653139352d646235392d343035662d613664372d3231393862356533326130350204011800050201000405004c57c300_f2db3329fe5ea2fd06e2ad245da1965e_1","type":"6"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/download_file' 
--header 'Content-Type: application/json' 
--data-raw '{"from_user":"","total_len":"31538","MsgId":2754393265637994605,"path":"d:\罗泽南8月考勤表.xlsx","attachid":"@cdn_3057020100044b3049020100020403e0b2d502032df85f020426372f70020468baeb70042439666537653139352d646235392d343035662d613664372d3231393862356533326130350204011800050201000405004c57c300_f2db3329fe5ea2fd06e2ad245da1965e_1","type":"6"}'
```

### 获取配置文件保存目录
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_config_path`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194240e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_config_path'
```

Response example:
```json
{
    "code": 1,
    "configPath": "C:\Users\Admin\AppData\Roaming\WechatTools\config.ini",
    "data": null
}
```

### 下载视频
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/download_video`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194242e0

Request example:
```json
{"total_len":68264760,"NewMsgId":150973212120165915,"path":"d:\121.mp4","MsgId":425004325}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/download_video' 
--header 'Content-Type: application/json' 
--data-raw '{"total_len":68264760,"NewMsgId":150973212120165915,"path":"d:\121.mp4","MsgId":425004325}'
```

### 防撤回
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/anti_revoke`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194243e0

Request example:
```json
{"swtich":"true"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/anti_revoke' 
--header 'Content-Type: application/json' 
--data-raw '{"swtich":"true"}'
```

### 下载语音
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/download_voice`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194253e0

Request example:
```json
{"newMsgId":"","length":"","MsgId":"","path":""}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/download_voice' 
--header 'Content-Type: application/json' 
--data-raw '{"newMsgId":"","length":"","MsgId":"","path":""}'
```

### cdn下载
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/cdn_download`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194254e0

Request example:
```json
{
    "fileid": "3057020100044b30490201000204d790fe2802032dd2170204f41193240204693242d6042466373263373336322d633435612d343166652d386432332d6636326230313262653064380204251508020201000405004c511f00",
    "asekey": "ae38eb5aee69ba62e6b3a94ecfc76c5f",
    "imgType": 2,
    "out": "F:\wechat_img\11111111112.jpg"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/cdn_download' 
--header 'Content-Type: application/json' 
--data-raw '{
    "fileid": "3057020100044b30490201000204d790fe2802032dd2170204f41193240204693242d6042466373263373336322d633435612d343166652d386432332d6636326230313262653064380204251508020201000405004c511f00",
    "asekey": "ae38eb5aee69ba62e6b3a94ecfc76c5f",
    "imgType": 2,
    "out": "F:\wechat_img\11111111112.jpg"
}'
```

### 更新单个用户资料
- Method: `POST`
- URL: `http://7ae708ac24f643289bd7825fb03eec6d.frp.sicuropay.com/api/update_single_profile`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194255e0

Request example:
```json
{"wxid":"49866796771@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://7ae708ac24f643289bd7825fb03eec6d.frp.sicuropay.com/api/update_single_profile' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"49866796771@chatroom"}'
```

Response example:
```json
{
    "alias": "",
    "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/UtLAESIsbSVID3ms1eg1oTvjUNTLWS7qiceImgk7jUAm6Y7PZ7icTsuEoyHibvXLFd5AxkSK30M8agHicSl0Z9kUFWIrvfvxLpBBx3nDV1hClV6FZiaksQegnJfK9welYDqfj/0",
    "bitMask": 4294967295,
    "bitVal": 1,
    "city": "",
    "country": "",
    "encryptUserName": "v3_020b3826fd03010000000000ca8402b5500f2c000000501ea9a3dba12f95f6b60a0536a1adb6b42927056065fce45dd36cbd2be7e1ec6ac3334980b27d1fa6952c948e721935a76b34b6aa3b57e6b5dcf90dc2@stranger",
    "hasWeiXinHdHeadImg": 1,
    "imgBuf": {
        "buffer": "",
        "iLen": 0
    },
    "imgFlag": 2,
    "nickName": {
        "String": "文件传输助手"
    },
    "province": "",
    "pyinitial": {
        "String": "WJCSZS"
    },
    "quanPin": {
        "String": "wenjianchuanshuzhushou"
    },
    "remark": {
        "String": ""
    },
    "remarkPyinitial": {
        "String": ""
    },
    "remarkQuanPin": {
        "String": ""
    },
    "sex": 0,
    "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/UtLAESIsbSVID3ms1eg1oTvjUNTLWS7qiceImgk7jUAm6Y7PZ7icTsuEoyHibvXLFd5AxkSK30M8agHicSl0Z9kUFWIrvfvxLpBBx3nDV1hClV6FZiaksQegnJfK9welYDqfj/132",
    "snsUserInfo": {
        "snsFlag": 0
    },
    "textStatusExtInfo": "",
    "textStatusFlag": 2,
    "textStatusId": "",
    "userName": {
        "String": "filehelper"
    },
    "verifyFlag": 0
}
```

### 撤回任何消息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/revoke_any`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194260e0

Request example:
```json
{"newMsgId":2050044161371926385,"createTime":1761391928,"toUserName":"49767299448@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/revoke_any' 
--header 'Content-Type: application/json' 
--data-raw '{"newMsgId":2050044161371926385,"createTime":1761391928,"toUserName":"49767299448@chatroom"}'
```

### 获取cdn信息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_cdn_info`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194276e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_cdn_info'
```

## ????

### 修改我所在群的群昵称
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/mod_chat_room_self_nick_name`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194159e0

Request example:
```json
{"roomId":"48520920817@chatroom","nickName":"叭叭叭"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/mod_chat_room_self_nick_name' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"48520920817@chatroom","nickName":"叭叭叭"}'
```

Response example:
```json
{"ret":0,"oplogRet":{"count":1,"ret":[0],"errMsg":[{}]}}
```

### 获取群成员列表
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_room_members`
- Content-Type: `application/json`
- RespRef: `R2`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194181e0

Request example:
```json
{"room_id":"49866796771@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_room_members' 
--header 'Content-Type: application/json' 
--data-raw '{"room_id":"49866796771@chatroom"}'
```

### 获取群详情缓存
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_chatroom_detail_cache`
- Content-Type: `application/json`
- RespRef: `R2`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194182e0

Request example:
```json
{"roomId":"43029636852@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_chatroom_detail_cache' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"43029636852@chatroom"}'
```

### 查询群成员信息
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_group_member_contact`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194188e0

Request example:
```json
{"wxid":"wxid_3e9mll0g0fad21","roomId":"45220347292@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_group_member_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"wxid_3e9mll0g0fad21","roomId":"45220347292@chatroom"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "contactCount": 1,
    "contactList": [
        {
            "userName": {
                "String": "群成员的wxid"
            },
            "nickName": {
                "String": "不必"
            },
            "pyinitial": {
                "String": "BB"
            },
            "quanPin": {
                "String": "bubi"
            },
            "sex": 1,
            "imgBuf": {
                "iLen": 0
            },
            "bitMask": 4294967295,
            "bitVal": 3,
            "imgFlag": 3,
            "remark": {
                "String": "9763"
            },
            "remarkPyinitial": {
                "String": "9763"
            },
            "remarkQuanPin": {
                "String": "9763"
            },
            "contactType": 0,
            "roomInfoCount": 0,
            "domainList": {},
            "chatRoomNotify": 0,
            "addContactScene": 0,
            "province": "Zhejiang",
            "city": "Hangzhou",
            "signature": "特别害怕失去很熟悉的人",
            "personalCard": 1,
            "hasWeiXinHdHeadImg": 1,
            "verifyFlag": 0,
            "level": 0,
            "source": 3,
            "alias": "jryswygq",
            "weiboFlag": 0,
            "albumStyle": 0,
            "albumFlag": 0,
            "snsUserInfo": {
                "snsFlag": 1,
                "snsBgimgId": "http://shmmsns.qpic.cn/mmsns/qcKhiayu3sNlcQLCwMDHfX38h9o7pCHkLtgBam5F6IgeABvibBTTib1bXiaVjCPZzEYTtVsbvian0EIk/0",
                "snsBgobjectId": "14693141287014765172",
                "snsFlagEx": 7297,
                "snsPrivacyRecent": 72
            },
            "country": "CN",
            "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/hic1c1goZbfmqcPfk2UllbdDGA5TC4ZwB7uINxase77pCZX2OU2MicGBw1ia3jBHKLPnbcSoySrCfsul8DjQBwAAAyPTA5Th5yibtZNBuxZhR8KIWvRqTGXNEQgticdEF61SX/0",
            "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/hic1c1goZbfmqcPfk2UllbdDGA5TC4ZwB7uINxase77pCZX2OU2MicGBw1ia3jBHKLPnbcSoySrCfsul8DjQBwAAAyPTA5Th5yibtZNBuxZhR8KIWvRqTGXNEQgticdEF61SX/132",
            "myBrandList": "<brandlist></brandlist>",
            "customizedInfo": {
                "brandFlag": 0
            },
            "headImgMd5": "00a7b20ff61ed9356a1221a6e265134d",
            "encryptUserName": "V3",
            "additionalContactList": {
                "linkedinContactItem": {}
            },
            "chatroomVersion": 0,
            "chatroomMaxCount": 0,
            "chatroomAccessType": 0,
            "newChatroomData": {
                "memberCount": 0,
                "infoMask": 0,
                "chatRoomUserName": {
                    "String": "49767299448@chatroom"
                },
                "watchMemberCount": 0
            },
            "deleteFlag": 0,
            "phoneNumListInfo": {
                "count": 0
            },
            "chatroomInfoVersion": 0,
            "deleteContactScene": 0,
            "chatroomStatus": 0,
            "extFlag": 0,
            "chatRoomBusinessType": "0",
            "friendUserName": "群成员的wxid",
            "textStatusFlag": 2,
            "ringBackSetting": {
                "finderObjectId": "0",
                "startTs": 0,
                "endTs": 0
            },
            "bitMask2": "18446744073709551615",
            "bitValue2": "256",
            "contactExtraInfoBuf": {
                "iLen": 0
            },
            "isInChatRoom": 0,
            "eraseChatRoomMemberData": 0
        }
    ],
    "ret": [
        0
    ],
    "verifyUserValidTicketList": {
        "username": "群成员的wxid",
        "antispamticket": "V4"
    }
}
```

### 创建群聊
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/creat_chat_room`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194195e0

Request example:
```json
{"wxids":"wxid_3e9mll0g0fad21,wxid_8543785438012"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/creat_chat_room' 
--header 'Content-Type: application/json' 
--data-raw '{"wxids":"wxid_3e9mll0g0fad21,wxid_8543785438012"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": -2,
        "errMsg": {
            "String": "<e>
<ShowType>1</ShowType>
<Content><![CDATA[创建群聊失败]]></Content>
<Url><![CDATA[]]></Url>
<DispSec>30</DispSec>
<Title><![CDATA[]]></Title>
<Action>4</Action>
<DelayConnSec>0</DelayConnSec>
<Countdown>0</Countdown>
<Ok><![CDATA[]]></Ok>
<Cancel><![CDATA[]]></Cancel>
<Icon>0</Icon>
</e>
"
        }
    },
    "topic": {},
    "pyinitial": {},
    "quanPin": {},
    "memberCount": 0,
    "chatRoomName": {},
    "imgBuf": {
        "iLen": 0
    }
}
```

### 邀请进入群聊
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/invite_member_to_chat_room`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194203e0

Request example:
```json
{
    "wxid_list": "wxid1,wxid2,wxid3",
    "room_id": "38994638667@chatroom"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/invite_member_to_chat_room' 
--header 'Content-Type: application/json' 
--data-raw '{
    "wxid_list": "wxid1,wxid2,wxid3",
    "room_id": "38994638667@chatroom"
}'
```

### 添加群成员40人以内
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/add_member_to_chat_room`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194204e0

Request example:
```json
{
    "wxid_list": "wxid_3e9mll0g0fad21",
    "room_id": "45220347292@chatroom"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/add_member_to_chat_room' 
--header 'Content-Type: application/json' 
--data-raw '{
    "wxid_list": "wxid_3e9mll0g0fad21",
    "room_id": "45220347292@chatroom"
}'
```

### 添加群管理
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/api/set_room_admin`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194205e0

Request example:
```json
{"roomId":"49767299448@chatroom","admin":"wxid_8543785438012"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/api/set_room_admin' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"49767299448@chatroom","admin":"wxid_8543785438012"}'
```

### 删除群管理
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/api/del_room_admin`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194206e0

Request example:
```json
{"roomId":"49767299448@chatroom","admin":"wxid_8543785438012"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/api/del_room_admin' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"49767299448@chatroom","admin":"wxid_8543785438012"}'
```

### 设置群公告
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/set_room_announcement_pb`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194207e0

Request example:
```json
{"roomId":"51687237616@chatroom","announcement":"通知一下 下次别用之前的群公告版本了"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/set_room_announcement_pb' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"51687237616@chatroom","announcement":"通知一下 下次别用之前的群公告版本了"}'
```

### 踢出群成员
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/del_member_from_chat_room`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194208e0

Request example:
```json
{"wxid_list":"wxid_8543785438012","room_id":"49767299448@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/del_member_from_chat_room' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid_list":"wxid_8543785438012","room_id":"49767299448@chatroom"}'
```

### 退出群聊
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/quit_and_del_chat_room`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194222e0

Request example:
```json
{"roomId":"xxxxxxxxxxxx"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/quit_and_del_chat_room' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"xxxxxxxxxxxx"}'
```

### 同意群聊邀请
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/enter_room`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194227e0

Request example:
```json
{"url":"https://support.weixin.qq.com/cgi-bin/mmsupport-bin/addopenimchatroombyinvite?ticket=BruwhiVyeJBslI7b"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/enter_room' 
--header 'Content-Type: application/json' 
--data-raw '{"url":"https://support.weixin.qq.com/cgi-bin/mmsupport-bin/addopenimchatroombyinvite?ticket=BruwhiVyeJBslI7b"}'
```

### 获取群详情
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_chatroom_info`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194237e0

Request example:
```json
{
    "roomId": "44830633256@chatroom"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_chatroom_info' 
--header 'Content-Type: application/json' 
--data-raw '{
    "roomId": "44830633256@chatroom"
}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": -2,
        "errMsg": {}
    },
    "chatRoomInfoVersion": 0,
    "announcementPublishTime": 0,
    "chatRoomStatus": 0,
    "chatRoomBusinessType": "0",
    "roomTools": {
        "roomToolsWxAppCount": 0
    },
    "roomBindAppList": {
        "roomBindAppListCount": 0
    },
    "spamStatus": 0,
    "finderInfo": {
        "iLen": 0
    },
    "topMsgInfo": {
        "iLen": 0
    }
}
```

### 保存群聊到通讯录
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/save_chatroom_to_contact`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194238e0

Request example:
```json
{"roomId":"群id"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/save_chatroom_to_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"群id"}'
```

### 移除群聊通讯录
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/remov_chatroom_to_contact`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194239e0

Request example:
```json
{"roomId":"群id"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/remov_chatroom_to_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"群id"}'
```

### 获取群聊列表
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_chatroom_list`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194259e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_chatroom_list'
```

### 修改群名称
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/mod_chatroom_topic`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194261e0

Request example:
```json
{"wxid":"49767299448@chatroom","topic":"需要修改成的名称"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/mod_chatroom_topic' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"49767299448@chatroom","topic":"需要修改成的名称"}'
```

### 获取所有群的资料(网络获取长耗时接口)
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/batch_getroom_contact`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194271e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/batch_getroom_contact'
```

### 获取所有的群资料(缓存速度极快)
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/batch_getroom_cache`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194272e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/batch_getroom_cache'
```

### 初始化群聊
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/init_rooms`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194273e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/init_rooms'
```

### 获取群成员简要信息(获取群成员昵称接口)
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_member_nick`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194274e0

Request example:
```json
{"wxid":"wxid_3e9mll0g0fad21","roomId":"49866796771@chatroom"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_member_nick' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"wxid_3e9mll0g0fad21","roomId":"49866796771@chatroom"}'
```

### 转让群主
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/transferchatroomowner`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194275e0

Request example:
```json
{
    "to_wxid": "string",
    "roomId": "string"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/transferchatroomowner' 
--header 'Content-Type: application/json' 
--data-raw '{
    "to_wxid": "string",
    "roomId": "string"
}'
```

## ??????

### 搜索微信号/手机号
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/net_scene_search_contact`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194184e0

Request example:
```json
{"search":"搜索微信号还是手机号"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/net_scene_search_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"search":"搜索微信号还是手机号"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {
            "String": "Everything is OK"
        }
    },
    "userName": {
        "String": "v3_020b3826fd03010000000000c7f228b4f06efa000000501ea9a3dba12f95f6b60a0536a1adb6f580631340234a6fd1c318fd5de96fe637ffb434b1d4fe0f451c904eb4aba33f1a4b8c976735c47abb45dd77e67209c666ce8e85fbb59d586e0157f8@stranger"
    },
    "nickName": {
        "String": "悬淼"
    },
    "pyinitial": {
        "String": "wxid_hify7vdpvg5d22"
    },
    "quanPin": {
        "String": "wxid_hify7vdpvg5d22"
    },
    "sex": 0,
    "imgBuf": {
        "iLen": 0
    },
    "signature": "天上天下，唯我独尊",
    "personalCard": 1,
    "verifyFlag": 0,
    "weiboFlag": 0,
    "albumStyle": 0,
    "albumFlag": 0,
    "snsUserInfo": {
        "snsFlag": 0,
        "snsBgobjectId": "0",
        "snsFlagEx": 0,
        "snsPrivacyRecent": 0
    },
    "customizedInfo": {
        "brandFlag": 0
    },
    "contactCount": 0,
    "bigHeadImgUrl": "http://wx.qlogo.cn/mmhead/ver_1/H9ukOUmCmkabkwXmfTbiaNZLuFpLKzgGSxaZ5IzY0pUPdCshNmuzwgFSLLDe2mZlNUKysKGaqefgWUFseqTFdoviaW6Sny7kQ09iaiaH5go8LyNqBJw7Lzh2AyWPms2MoKef/0",
    "smallHeadImgUrl": "http://wx.qlogo.cn/mmhead/ver_1/H9ukOUmCmkabkwXmfTbiaNZLuFpLKzgGSxaZ5IzY0pUPdCshNmuzwgFSLLDe2mZlNUKysKGaqefgWUFseqTFdoviaW6Sny7kQ09iaiaH5go8LyNqBJw7Lzh2AyWPms2MoKef/132",
    "resBuf": {
        "iLen": 0
    },
    "antispamTicket": "v4_000b708f0b04000001000000000029ac3dc68a17dea708381427a5681000000050ded0b020927e3c97896a09d47e6e9eb3fbad3b5aa09a6124b67addb011f45e340030f8d0743331300126b01af1cbba4a7ecbfa7a7dfe8d3622d0412a8243b323aa2eac8f59b61aeeaaaeb5c083362db9bc4ab949ef4c89557f289493d143ec1f216ad6648091cf@stranger",
    "matchType": 2,
    "extFlag": 0,
    "searchContactJumpInfo": {}
}
```

### 网络查询好友资料
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_contact`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194187e0

Request example:
```json
{"wxid":"filehelper"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"filehelper"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "contactCount": 1,
    "contactList": [
        {
            "userName": {
                "String": "被查询人的wxid"
            },
            "nickName": {
                "String": "不必"
            },
            "pyinitial": {
                "String": "BB"
            },
            "quanPin": {
                "String": "bubi"
            },
            "sex": 1,
            "imgBuf": {
                "iLen": 0
            },
            "bitMask": 4294967295,
            "bitVal": 3,
            "imgFlag": 3,
            "remark": {
                "String": "9763"
            },
            "remarkPyinitial": {
                "String": "9763"
            },
            "remarkQuanPin": {
                "String": "9763"
            },
            "contactType": 0,
            "roomInfoCount": 0,
            "domainList": {},
            "chatRoomNotify": 0,
            "addContactScene": 0,
            "province": "Zhejiang",
            "city": "Hangzhou",
            "signature": "特别害怕失去很熟悉的人",
            "personalCard": 1,
            "hasWeiXinHdHeadImg": 1,
            "verifyFlag": 0,
            "level": 0,
            "source": 3,
            "alias": "jryswygq",
            "weiboFlag": 0,
            "albumStyle": 0,
            "albumFlag": 0,
            "snsUserInfo": {
                "snsFlag": 1,
                "snsBgimgId": "http://shmmsns.qpic.cn/mmsns/qcKhiayu3sNlcQLCwMDHfX38h9o7pCHkLtgBam5F6IgeABvibBTTib1bXiaVjCPZzEYTtVsbvian0EIk/0",
                "snsBgobjectId": "14693141287014765172",
                "snsFlagEx": 7297,
                "snsPrivacyRecent": 72
            },
            "country": "CN",
            "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/hic1c1goZbfmqcPfk2UllbdDGA5TC4ZwB7uINxase77pCZX2OU2MicGBw1ia3jBHKLPnbcSoySrCfsul8DjQBwAAAyPTA5Th5yibtZNBuxZhR8KIWvRqTGXNEQgticdEF61SX/0",
            "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/hic1c1goZbfmqcPfk2UllbdDGA5TC4ZwB7uINxase77pCZX2OU2MicGBw1ia3jBHKLPnbcSoySrCfsul8DjQBwAAAyPTA5Th5yibtZNBuxZhR8KIWvRqTGXNEQgticdEF61SX/132",
            "myBrandList": "<brandlist></brandlist>",
            "customizedInfo": {
                "brandFlag": 0
            },
            "headImgMd5": "00a7b20ff61ed9356a1221a6e265134d",
            "encryptUserName": "v3",
            "additionalContactList": {
                "linkedinContactItem": {}
            },
            "chatroomVersion": 0,
            "chatroomMaxCount": 0,
            "chatroomAccessType": 0,
            "newChatroomData": {
                "memberCount": 0,
                "infoMask": 0,
                "chatRoomUserName": {},
                "watchMemberCount": 0
            },
            "deleteFlag": 0,
            "phoneNumListInfo": {
                "count": 0
            },
            "chatroomInfoVersion": 0,
            "deleteContactScene": 0,
            "chatroomStatus": 0,
            "extFlag": 0,
            "chatRoomBusinessType": "0",
            "friendUserName": "对方wxid",
            "textStatusFlag": 2,
            "ringBackSetting": {
                "finderObjectId": "0",
                "startTs": 0,
                "endTs": 0
            },
            "bitMask2": "18446744073709551615",
            "bitValue2": "256",
            "contactExtraInfoBuf": {
                "iLen": 0
            },
            "isInChatRoom": 0,
            "eraseChatRoomMemberData": 0
        }
    ],
    "ret": [
        0
    ],
    "verifyUserValidTicketList": {
        "username": "对方wxid",
        "antispamticket": "V4"
    }
}
```

### 获取A8key
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_a8key`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194189e0

Request example:
```json
{
    "url": "https://support.weixin.qq.com/cgi-bin/mmsupport-bin/addchatroombyinvite?ticket=AwfZ4kSJ9P2FbmFK6LPrpg%3D%3D",
    "urlType": "0",
    "scene": "0"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_a8key' 
--header 'Content-Type: application/json' 
--data-raw '{
    "url": "https://support.weixin.qq.com/cgi-bin/mmsupport-bin/addchatroombyinvite?ticket=AwfZ4kSJ9P2FbmFK6LPrpg%3D%3D",
    "urlType": "0",
    "scene": "0"
}'
```

### 获取小程序code
- Method: `POST`
- URL: `http://192.168.3.5:19088/api/js_login`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194191e0

Request example:
```json
{"waId":"wxaf48360fec8b1f0c"}
```

cURL:
```bash
curl --location --request POST 'http://192.168.3.5:19088/api/js_login' 
--header 'Content-Type: application/json' 
--data-raw '{"waId":"wxaf48360fec8b1f0c"}'
```

Response example:
```json
{
    "result": "fail",
    "msg": "protobuf parse failed"
}
```

### 验证好友请求
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/verify_friend`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194194e0

Request example:
```json
{
    "v3":"v3_020b3826fd030100000000005f2b2bd9947385000000501ea9a3dba12f95f6b60a0536a1adb6f580631340234a6fd1c318fd8278657a4cf2987caea63020d2e155a519f9dfa519eab0af804b64eff6c022032dfd406af7e1acb60949bf368e977cc6@stranger",
    "v4":"v4_000b708f0b040000010000000000e688a70292f10fd5b0ea8e7dfa671000000050ded0b020927e3c97896a09d47e6e9eb1507dd07a6e2b5bcded893023cabade024616a6e2f66f233d7bd569d17097eccab67013d555ef0643d7808009487ea000460ff4d87fea808678bab1dc8cd008fc953bed97ca89932fcd123d14b2c7b017333846599fbaac9f1efedee4b72a36c5c1b77077d04d2c@stranger",
    "scene": "3"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/verify_friend' 
--header 'Content-Type: application/json' 
--data-raw '{
    "v3":"v3_020b3826fd030100000000005f2b2bd9947385000000501ea9a3dba12f95f6b60a0536a1adb6f580631340234a6fd1c318fd8278657a4cf2987caea63020d2e155a519f9dfa519eab0af804b64eff6c022032dfd406af7e1acb60949bf368e977cc6@stranger",
    "v4":"v4_000b708f0b040000010000000000e688a70292f10fd5b0ea8e7dfa671000000050ded0b020927e3c97896a09d47e6e9eb1507dd07a6e2b5bcded893023cabade024616a6e2f66f233d7bd569d17097eccab67013d555ef0643d7808009487ea000460ff4d87fea808678bab1dc8cd008fc953bed97ca89932fcd123d14b2c7b017333846599fbaac9f1efedee4b72a36c5c1b77077d04d2c@stranger",
    "scene": "3"
}'
```

### 快速查找好友资料(非常快)
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_contact_fast`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194200e0

Request example:
```json
{"wxid":"wxid_rdpo01enuad821"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_contact_fast' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"wxid_rdpo01enuad821"}'
```

Response example:
```json
{
    "contact": {
        "alias": "",
        "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/fKufuRnT26ianqvqMDmkqSGb1nyezCStqvyHhOL5PLMRqvM8UfxYD4EOXibox1oTsaNLjY8cEk7EJculnbH9cm9KOze8IFWI5Aoibc4umTxPiayibDfXibvfjoA4mjroHJUtVf/0",
        "bitMask": 4294967295,
        "bitVal": 3,
        "city": "",
        "country": "",
        "encryptUserName": "v3_020b3826fd03010000000000283d02027bc00e000000501ea9a3dba12f95f6b60a0536a1adb6f580631340234a6fd1c318fdb3566c7e0f6dd453b321e7729cd107b0e7f2e215e554ae6e2e881d8a917e9584@stranger",
        "hasWeiXinHdHeadImg": 1,
        "imgBuf": {
            "buffer": "",
            "iLen": 0
        },
        "imgFlag": 2,
        "nickName": {
            "String": "文件传输助手"
        },
        "province": "",
        "pyinitial": {
            "String": "WJCSZS"
        },
        "quanPin": {
            "String": "wenjianchuanshuzhushou"
        },
        "remark": {
            "String": ""
        },
        "remarkPyinitial": {
            "String": ""
        },
        "remarkQuanPin": {
            "String": ""
        },
        "sex": 0,
        "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/fKufuRnT26ianqvqMDmkqSGb1nyezCStqvyHhOL5PLMRqvM8UfxYD4EOXibox1oTsaNLjY8cEk7EJculnbH9cm9KOze8IFWI5Aoibc4umTxPiayibDfXibvfjoA4mjroHJUtVf/132",
        "snsUserInfo": {
            "snsFlag": 0
        },
        "textStatusExtInfo": "",
        "textStatusFlag": 2,
        "textStatusId": "",
        "userName": {
            "String": "filehelper"
        },
        "verifyFlag": 0
    },
    "ret": 0,
    "username": "filehelper"
}
```

### 更新好友列表
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/update_all_friend`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194202e0

Request example:
```json
{}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/update_all_friend' 
--header 'Content-Type: application/json' 
--data-raw '{}'
```

### 修改好友备注
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/remark_contact`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194209e0

Request example:
```json
{"wxid":"wxid_ozyqateb85un22","remark":"111"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/remark_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"wxid_ozyqateb85un22","remark":"111"}'
```

### 删除好友
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/del_contact`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194210e0

Request example:
```json
{"wxid":"wxid_8543785438012"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/del_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"wxid_8543785438012"}'
```

### 获取标签列表
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_label_lists`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194232e0

Request example:
```json
{}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_label_lists' 
--header 'Content-Type: application/json' 
--data-raw '{}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "labelCount": 7,
    "labelPairList": [
        {
            "labelName": "取完钱",
            "labelId": 2
        },
        {
            "labelName": "1",
            "labelId": 7
        },
        {
            "labelName": "2",
            "labelId": 8
        },
        {
            "labelName": "777777777777",
            "labelId": 9
        },
        {
            "labelName": "标签名字6667",
            "labelId": 11
        },
        {
            "labelName": "6666666666666666",
            "labelId": 6
        },
        {
            "labelName": "15454454545",
            "labelId": 10
        }
    ]
}
```

### 增加标签
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/add_label`
- Content-Type: `application/json`
- RespRef: `R5`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194233e0

Request example:
```json
{"label":"标签名字"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/add_label' 
--header 'Content-Type: application/json' 
--data-raw '{"label":"标签名字"}'
```

### 删除标签
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/del_label`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194234e0

Request example:
```json
{"label_id":"33"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/del_label' 
--header 'Content-Type: application/json' 
--data-raw '{"label_id":"33"}'
```

### 修改好友标签
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/modify_contact_label`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194235e0

Request example:
```json
{"wxids":"wxid_8543785438012","labelId":"2,6"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/modify_contact_label' 
--header 'Content-Type: application/json' 
--data-raw '{"wxids":"wxid_8543785438012","labelId":"2,6"}'
```

### 更新标签名字
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/update_label_name`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194236e0

Request example:
```json
{"labelId":1,"newName":"新标签名字"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/update_label_name' 
--header 'Content-Type: application/json' 
--data-raw '{"labelId":1,"newName":"新标签名字"}'
```

### 获取附近人
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_lbs_friend`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194241e0

Request example:
```json
{"longitude":"120.24646699999994","latitude":"30.197153999999998"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_lbs_friend' 
--header 'Content-Type: application/json' 
--data-raw '{"longitude":"120.24646699999994","latitude":"30.197153999999998"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": "返回码，0 表示成功",
        "errMsg": "错误信息"
    },
    "contactCount": "联系人数量",
    "contactList": [
        {
            "userName": "用户名（可能是加密后的唯一标识）",
            "nickName": "昵称",
            "province": "省份",
            "city": "城市",
            "signature": "个性签名",
            "distance": "距离（与自己的物理距离）",
            "sex": "性别（1=男，2=女，0=未知）",
            "imgStatus": "头像状态",
            "verifyFlag": "认证标志",
            "weiboFlag": "是否绑定微博",
            "headImgVersion": "头像版本号",
            "snsUserInfo": {
                "snsFlag": "朋友圈标志（是否开启朋友圈）",
                "snsBgimgId": "朋友圈背景图链接",
                "snsBgobjectId": "朋友圈背景图对象ID",
                "snsFlagEx": "朋友圈扩展标志位",
                "snsPrivacyRecent": "朋友圈隐私设置"
            },
            "country": "国家",
            "bigHeadImgUrl": "大头像 URL",
            "smallHeadImgUrl": "小头像 URL",
            "customizedInfo": {
                "brandFlag": "品牌标志（公众号/企业号相关）"
            },
            "antispamTicket": "防骚扰 ticket（陌生人校验用）",
            "flag": "标志位",
            "finderFlag": "视频号标志"
        }
    ],
    "state": "状态码",
    "flushTime": "刷新时间（秒）",
    "isShowRoom": "是否显示聊天室",
    "roomMemberCount": "聊天室成员数量"
}
```

### 置顶好友
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/set_top`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194262e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/set_top' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

### 取消置顶
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/cancel_top`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194263e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/cancel_top' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

### 星标好友
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/set_start`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194264e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/set_start' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

### 取消星标
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/del_start`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194265e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/del_start' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

### 开启消息免打扰 
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/set_mute_user`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194266e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/set_mute_user' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

### 关闭消息免打扰
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/del_mute_user`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194267e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/del_mute_user' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

### 拉黑好友
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/black_user`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194268e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/black_user' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

### 移出黑名单
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/del_black_user`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194269e0

Request example:
```json
{"wxid":"群wxid"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/del_black_user' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"群wxid"}'
```

## ???

### 发送朋友圈
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_post`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194176e0

Request example:
```json
{"content":"6666666666666666666666","blackList":"","withauserList":""}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_post' 
--header 'Content-Type: application/json' 
--data-raw '{"content":"6666666666666666666666","blackList":"","withauserList":""}'
```

### 发送图片朋友圈
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_send_img`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194177e0

Request example:
```json
{"filelist":"D:\7777777.jpg","content":"测试文字朋友圈"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_send_img' 
--header 'Content-Type: application/json' 
--data-raw '{"filelist":"D:\7777777.jpg","content":"测试文字朋友圈"}'
```

### 删除朋友圈评论
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_del_comment`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194217e0

Request example:
```json
{"sns_id":"14661929784229180031","commentId":"3"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_del_comment' 
--header 'Content-Type: application/json' 
--data-raw '{"sns_id":"14661929784229180031","commentId":"3"}'
```

### 朋友圈回复
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_comment_reply`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194218e0

Request example:
```json
{"content":"66666666666","sns_id":"14667428703163265648","comment_id":3}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_comment_reply' 
--header 'Content-Type: application/json' 
--data-raw '{"content":"66666666666","sns_id":"14667428703163265648","comment_id":3}'
```

### 删除朋友圈
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_del`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194219e0

Request example:
```json
{"sns_id":"14667428703163265648"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_del' 
--header 'Content-Type: application/json' 
--data-raw '{"sns_id":"14667428703163265648"}'
```

### 获取朋友圈详情
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_get_detail`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194220e0

Request example:
```json
{"sns_id":14420282581074719279}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_get_detail' 
--header 'Content-Type: application/json' 
--data-raw '{"sns_id":14420282581074719279}'
```

### 获取朋友圈首页
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_get_first_page`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194221e0

Request example:
```json
{
    "firstPageMd5": "string",
    "maxId": "string"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_get_first_page' 
--header 'Content-Type: application/json' 
--data-raw '{
    "firstPageMd5": "string",
    "maxId": "string"
}'
```

### 朋友圈图片上传
- Method: `POST`
- URL: `http://127.0.0.1:19089/api/sns_upload`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194228e0

Request example:
```json
{"filePath":"D:\1.jpg"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19089/api/sns_upload' 
--header 'Content-Type: application/json' 
--data-raw '{"filePath":"D:\1.jpg"}'
```

### 获取朋友圈下一页
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sns_get_next_page`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194245e0

Request example:
```json
{"lastItemid":"14689529228577936097"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sns_get_next_page' 
--header 'Content-Type: application/json' 
--data-raw '{"lastItemid":"14689529228577936097"}'
```

## ?????

### 获取登录二维码
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/reflash_qrcode`
- Content-Type: `application/xml`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194186e0

Request example:
```text
<?xml version="1.0" encoding="UTF-8"?>
<root/>
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/reflash_qrcode' 
--header 'Content-Type: application/xml' 
--data-raw '<?xml version="1.0" encoding="UTF-8"?>
<root/>'
```

### 获取数据库句柄
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_db_handle`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194196e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_db_handle'
```

Response example:
```json
{
    "data": [
        {
            "handle": 1984621919104,
            "name": "message_resource.db"
        },
        {
            "handle": 1984543430864,
            "name": "head_image.db"
        },
        {
            "handle": 1984543433120,
            "name": "biz_message_0.db"
        },
        {
            "handle": 1984543433872,
            "name": "key_info.db"
        },
        {
            "handle": 1984543427104,
            "name": "message_0.db"
        },
        {
            "handle": 1984543427856,
            "name": "contact.db"
        },
        {
            "handle": 1984543429360,
            "name": "message_fts.db"
        },
        {
            "handle": 1984543430112,
            "name": "message_1.db"
        },
        {
            "handle": 1984543431616,
            "name": "contact_fts.db"
        },
        {
            "handle": 1984543432368,
            "name": "session.db"
        },
        {
            "handle": 1984621918352,
            "name": "hardlink.db"
        },
        {
            "handle": 1984543428608,
            "name": "media_0.db"
        },
        {
            "handle": 1984621917600,
            "name": "emoticon.db"
        },
        {
            "handle": 1984621920608,
            "name": "favorite.db"
        },
        {
            "handle": 1984621916096,
            "name": "sns.db"
        },
        {
            "handle": 1984621916848,
            "name": "favorite_fts.db"
        },
        {
            "handle": 1984621919856,
            "name": "general.db"
        }
    ]
}
```

### 执行数据库查询
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/sqlite3_exec`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194197e0

Request example:
```json
{"db_name":"contact.db","sql_fmt":"SELECT username FROM contact WHERE username LIKE '%chatroom%'"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/sqlite3_exec' 
--header 'Content-Type: application/json' 
--data-raw '{"db_name":"contact.db","sql_fmt":"SELECT username FROM contact WHERE username LIKE '''%chatroom%'''"}'
```

Response example:
```json
[
    {
        "draft": "",
        "is_hidden": "0",
        "last_clear_unread_timestamp": "1747833113",
        "last_msg_ext_type": "0",
        "last_msg_locald_id": "0",
        "last_msg_sender": "",
        "last_msg_sub_type": "0",
        "last_msg_type": "0",
        "last_sender_display_name": "",
        "last_timestamp": "0",
        "sort_timestamp": "0",
        "status": "0",
        "summary": "",
        "type": "0",
        "unread_count": "0",
        "unread_first_msg_srv_id": "0",
        "unread_first_pat_msg_local_id": "0",
        "unread_first_pat_msg_sort_seq": "0",
        "username": "gh_166a0f0b7ce3"
    }
]
```

### 微信初始化_删除当前设备_慎用
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/wechat_init`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194246e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/wechat_init'
```

### 数据库备份 
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/backup_database`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194247e0

Request example:
```json
{"outputDir":"d:\backupdatabse","name":""}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/backup_database' 
--header 'Content-Type: application/json' 
--data-raw '{"outputDir":"d:\backupdatabse","name":""}'
```

### 获取登陆状态
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/check_login`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194256e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/check_login' 
--header 'Content-Type: application/json' 
--data-raw '{}'
```

### 退出登陆
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/logout`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194258e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/logout' 
--header 'Content-Type: application/json' 
--data-raw '{}'
```

## ????

### 个人发送文本消息回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194178e0

cURL:
```bash
curl --location --request PUT '个人发送文本消息回调'
```

Response example:
```json
{
    "account_wxid": "wxid_8543785438012",
    "count": 1,
    "http_port": 19088,
    "hwnd": 0,
    "list": [
        {
            "clientMsgId": 2042112957,
            "content": "1",
            "createTime": 1761111003,
            "msgSource": "<msgsource><alnode><fr>1</fr></alnode></msgsource>",
            "toUserName": {
                "String": "filehelper"
            },
            "type": 1
        }
    ],
    "messageDesc": "自己发送的文本消息",
    "messageType": 1,
    "pid": 4484,
    "systemCode": 1919
}
```

### 个人发送图片消息回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194179e0

cURL:
```bash
curl --location --request PUT '个人发送图片消息回调'
```

Response example:
```json
{
    "account_wxid": "wxid_8543785438012",
    "aeskey": "05f8f6033dcfbc67af458799dda91bce",
    "cdnbigImgSize": 774,
    "cdnbigImgUrl": "3057020100044b3049020100020403e0b2d502032f58b70204ef663270020468f86c08042434373533653063352d653866642d343231662d393535362d3233306563353966383239650204051438010201000405004c511f00",
    "cdnmidImgSize": 774,
    "cdnmidImgUrl": "3057020100044b3049020100020403e0b2d502032f58b70204ef663270020468f86c08042434373533653063352d653866642d343231662d393535362d3233306563353966383239650204051438010201000405004c511f00",
    "cdnthumbAeskey": "05f8f6033dcfbc67af458799dda91bce",
    "cdnthumbImgHeight": 115,
    "cdnthumbImgSize": 1026,
    "cdnthumbImgUrl": "3057020100044b3049020100020403e0b2d502032f58b70204ef663270020468f86c08042434373533653063352d653866642d343231662d393535362d3233306563353966383239650204051438010201000405004c511f00",
    "cdnthumbImgWidth": 180,
    "clientImgId": {
        "String": "filehelper_1761111047_321_xwechat_2"
    },
    "compressType": 1,
    "crc32": 729956813,
    "data": {
        "buffer": "",
        "iLen": 0
    },
    "dataLen": 1026,
    "encryVer": 1,
    "fromUserName": {
        "String": "wxid_8543785438012"
    },
    "hevcMidSize": 0,
    "hitMd5": 0,
    "http_port": 19088,
    "hwnd": 0,
    "imgType": 0,
    "md5": "888889ce19e57e7404215d4d54a565d7",
    "messageDesc": "自己发送的图片消息",
    "messageType": 2,
    "msgSource": "<msgsource><img_file_name>2f4dfe20-6214-4403-9375-9bdb48b3aab0.png</img_file_name><alnode><fr>1</fr><cf>3</cf></alnode></msgsource>",
    "msgType": 3,
    "netType": 2,
    "photoFrom": 5,
    "pid": 4484,
    "startPos": 0,
    "systemCode": 1919,
    "toUserName": {
        "String": "filehelper"
    },
    "totalLen": 1026
}
```

### 个人发送文件/卡片/小程序/等等xml回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194180e0

cURL:
```bash
curl --location --request PUT '个人发送文件/卡片/小程序/等等xml回调'
```

Response example:
```json
{
    "account_wxid": "wxid_8543785438012",
    "crc32": 1247958169,
    "fileType": 7,
    "hitMd5": 0,
    "http_port": 19088,
    "hwnd": 0,
    "md5": "5e1f2bc1cf1d5de66bb6c04e417596ed",
    "messageDesc": "自己发送的应用消息",
    "messageType": 3,
    "msg": {
        "appId": "wx6618f1cfc6c132f8",
        "clientMsgId": "filehelper_1761111119_322_xwechat_3",
        "content": "<appmsg appid="wx6618f1cfc6c132f8" sdkver="0"><title>WeChatWin_4.1.2 (1).exe</title><des></des><action></action><type>6</type><showtype>0</showtype><soundtype>0</soundtype><mediatagname></mediatagname><messageext></messageext><messageaction></messageaction><content></content><contentattr>0</contentattr><url></url><lowurl></lowurl><dataurl></dataurl><lowdataurl></lowdataurl><songalbumurl></songalbumurl><songlyric></songlyric><template_id></template_id><appattach><totallen>212263904</totallen><attachid>@cdn_3057020100044b3049020100020403e0b2d502034c4cd302042c1c3170020468f86c52042430373565353862312d663034352d343964312d396333622d3336393732336266323264650204051800070201000405004c4cd300_f23899c92f162dddd74911a3dfa21d7d_1</attachid><emoticonmd5></emoticonmd5><fileext>exe</fileext><cdnattachurl>3057020100044b3049020100020403e0b2d502034c4cd302042c1c3170020468f86c52042430373565353862312d663034352d343964312d396333622d3336393732336266323264650204051800070201000405004c4cd300</cdnattachurl><aeskey>f23899c92f162dddd74911a3dfa21d7d</aeskey><encryver>0</encryver><overwrite_newmsgid>3509981863394347273</overwrite_newmsgid><fileuploadtoken>v1_ouBPQGyXFnSR6VupqSiQEarbh1+RnryKLZ0PAjD+cx/RSPeXnB462cdpB54pTTF7tIe+XTtsawr+WzZGrtvN+hZFXabZz9CkuaQ02w3McUFS7uDFbyHQzalPdX1Q4Ihpc2PZFzrs3Mn7uvAgHtp7vow401XOPXAxAp7x1y+eNEXdMP6hiQflg7LeQQCzEkBqNUjqnmRz+RDmxws=</fileuploadtoken></appattach><extinfo></extinfo><sourceusername></sourceusername><sourcedisplayname></sourcedisplayname><thumburl></thumburl><md5>5e1f2bc1cf1d5de66bb6c04e417596ed</md5><statextstr></statextstr></appmsg><fromusername>wxid_8543785438012</fromusername>",
        "createTime": 1761111119,
        "fromUserName": "wxid_8543785438012",
        "jsAppId": "",
        "msgSource": "<msgsource><alnode><fr>1</fr><cf>3</cf></alnode></msgsource>",
        "sdkVersion": 0,
        "shareUrlOpen": "",
        "shareUrlOriginal": "",
        "source": 1,
        "toUserName": "filehelper",
        "type": 6
    },
    "msgForwardType": 2,
    "pid": 4484,
    "signature": "8yyRfLbf5IEkCkwscTyakg7/luNj/qxwpRUmPI7S985R3neQnsrTbxYl8TU+ZJIERwG9cxdCjcwZ903snqvZx2J5AM8b/OFEBgfzpfKvgbHWqd2MTJEjycnaIYKs+m/bo3xpk7jU0ZOIWxi0DGtGSL708Ydh7lzBYciWIBM5Ia4=",
    "systemCode": 1919
}
```

### 群聊获取A8key
- Method: `POST`
- URL: N/A
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194190e0

Request example:
```json
{
    "url": "https://support.weixin.qq.com/cgi-bin/mmsupport-bin/addchatroombyinvite?ticket=AwfZ4kSJ9P2FbmFK6LPrpg%3D%3D",
    "urlType": "0",
    "scene": "0"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_a8key' 
--header 'Content-Type: application/json' 
--data-raw '{
    "url": "https://support.weixin.qq.com/cgi-bin/mmsupport-bin/addchatroombyinvite?ticket=AwfZ4kSJ9P2FbmFK6LPrpg%3D%3D",
    "urlType": "0",
    "scene": "0"
}'
```

### 获取好友资料(网络获取)
- Method: `POST`
- URL: N/A
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194201e0

Request example:
```json
{"wxid":"wxid_rj8cjqdrg5cl22"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_contact' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"wxid_rj8cjqdrg5cl22"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": 0,
        "errMsg": {}
    },
    "contactCount": 1,
    "contactList": [
        {
            "userName": {
                "String": "filehelper"
            },
            "nickName": {
                "String": "文件传输助手"
            },
            "pyinitial": {
                "String": "WJCSZS"
            },
            "quanPin": {
                "String": "wenjianchuanshuzhushou"
            },
            "sex": 0,
            "imgBuf": {
                "iLen": 0
            },
            "bitMask": 4294967295,
            "bitVal": 3,
            "imgFlag": 3,
            "remark": {},
            "remarkPyinitial": {},
            "remarkQuanPin": {},
            "contactType": 0,
            "roomInfoCount": 0,
            "domainList": {},
            "chatRoomNotify": 0,
            "addContactScene": 0,
            "personalCard": 0,
            "hasWeiXinHdHeadImg": 1,
            "verifyFlag": 0,
            "level": 0,
            "source": 6,
            "weiboFlag": 0,
            "albumStyle": 0,
            "albumFlag": 0,
            "snsUserInfo": {
                "snsFlag": 0,
                "snsBgobjectId": "0",
                "snsFlagEx": 16,
                "snsPrivacyRecent": 0
            },
            "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/fKufuRnT26ianqvqMDmkqSGb1nyezCStqvyHhOL5PLMRqvM8UfxYD4EOXibox1oTsaNLjY8cEk7EJculnbH9cm9KOze8IFWI5Aoibc4umTxPiayibDfXibvfjoA4mjroHJUtVf/0",
            "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/fKufuRnT26ianqvqMDmkqSGb1nyezCStqvyHhOL5PLMRqvM8UfxYD4EOXibox1oTsaNLjY8cEk7EJculnbH9cm9KOze8IFWI5Aoibc4umTxPiayibDfXibvfjoA4mjroHJUtVf/132",
            "customizedInfo": {
                "brandFlag": 0
            },
            "headImgMd5": "860baf36d77682daa9ce1210be61374e",
            "encryptUserName": "v3_020b3826fd03010000000000283d02027bc00e000000501ea9a3dba12f95f6b60a0536a1adb6f580631340234a6fd1c318fdb3566c7e0f6dd453b321e7729cd107b0e7f2e215e554ae6e2e881d8a917e9584@stranger",
            "additionalContactList": {
                "linkedinContactItem": {}
            },
            "chatroomVersion": 0,
            "chatroomMaxCount": 0,
            "chatroomAccessType": 0,
            "newChatroomData": {
                "memberCount": 0,
                "infoMask": 0,
                "chatRoomUserName": {},
                "watchMemberCount": 0
            },
            "deleteFlag": 0,
            "phoneNumListInfo": {
                "count": 0
            },
            "chatroomInfoVersion": 0,
            "deleteContactScene": 0,
            "chatroomStatus": 0,
            "extFlag": 0,
            "chatRoomBusinessType": "0",
            "friendUserName": "filehelper",
            "textStatusFlag": 2,
            "ringBackSetting": {
                "finderObjectId": "0",
                "startTs": 0,
                "endTs": 0
            },
            "bitMask2": "18446744073709551615",
            "bitValue2": "0",
            "contactExtraInfoBuf": {
                "iLen": 0
            },
            "isInChatRoom": 0,
            "eraseChatRoomMemberData": 0
        }
    ],
    "ret": [
        0
    ],
    "verifyUserValidTicketList": {
        "username": "filehelper",
        "antispamticket": "v4_000b708f0b0400000100000000007216f55900af00be97e0d58baf681000000050ded0b020927e3c97896a09d47e6e9e23b2464fed6bdfd91729d2159eef78ffea979d110f34e73a4d6d1247cc360645720f1e8928b6cb80404c08635111878eeafc925805736f6382dc8cc062d71929b3878d61500db77779d534021191ba6b6aaeab78f8357452@stranger"
    }
}
```

### 群聊消息回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194223e0

cURL:
```bash
curl --location --request PUT '主动推送的群聊消息'
```

Response example:
```json
{
    "content": {
        "String": "原始消息内容（包含发送者 wxid + 冒号 + 实际消息内容）"
    },
    "createTime": "消息创建时间（Unix 时间戳，秒）",
    "fromUserName": {
        "String": "群聊 ID（@chatroom 结尾）"
    },
    "imgBuf": {
        "iLen": "图片数据长度（0 表示无图片）"
    },
    "imgStatus": "图片状态（1=有图，0=无图）",
    "member_info": {
        "addChatRoomSceneNewXml": "入群场景 XML（包含邀请人信息）",
        "bigHeadImgUrl": "群成员头像大图 URL",
        "chatroomMemberFlag": "群成员标志位（内部字段）",
        "inviterUserName": "邀请者的 wxid",
        "nickName": "群成员昵称",
        "smallHeadImgUrl": "群成员头像小图 URL",
        "status": "群成员状态（0=正常，1=禁言 等）",
        "userName": "群成员的 wxid"
    },
    "messageType": "消息类型描述（群聊消息 / 私聊消息）",
    "msgId": "消息 ID（本地整型值）",
    "msgSeq": "消息序列号",
    "msgSource": "消息源的 XML（包含群信息，如成员数、签名等）",
    "msgType": "消息类型数值（1=文本，3=图片，43=视频 等）",
    "newMsgId": "消息唯一 ID（服务器下发，字符串类型）",
    "pushContent": "推送文案（昵称 + 消息内容，用于通知栏展示）",
    "real_content": "实际消息内容（去掉 wxid 和换行符之后的文本）",
    "sender_nick": "发送者昵称（可能为空）",
    "status": "消息状态（3=已送达 等）",
    "toUserName": {
        "String": "消息接收方 wxid（通常是自己）"
    }
}
```

### 私聊消息回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194224e0

cURL:
```bash
curl --location --request PUT '主动推送的私聊消息'
```

Response example:
```json
{
    "content": {
        "String": "消息内容（文本）"
    },
    "createTime": "消息创建时间（Unix 时间戳，秒）",
    "from": "来自登录的哪个wxid",
    "fromUserName": {
        "String": "发送者账号（wxid 或群号@chatroom）"
    },
    "http_port": "HTTP 服务端口（调试用）",
    "imgBuf": {
        "iLen": "图片数据长度（为 0 表示无图片）"
    },
    "imgStatus": "图片状态（1=有图，0=无图）",
    "messageType": "消息类型描述（如 私聊消息 / 群聊消息）",
    "msgId": "消息 ID（本地生成的整型值）",
    "msgSeq": "消息序列号",
    "msgSource": "消息源的 XML 描述（包含群成员数/签名等）",
    "msgType": "消息类型数值（1=文本，3=图片，43=视频 等）",
    "newMsgId": "消息唯一 ID（服务器下发，字符串类型）",
    "pid": "进程 ID（调试信息）",
    "pushContent": "推送内容（带有发送者昵称 + 消息预览）",
    "sender_nick": "发送者昵称（可能为空）",
    "sender_profile": {
        "alias": "用户别名",
        "bigHeadImgUrl": "用户头像大图 URL",
        "bitMask": "标志位（内部用途）",
        "bitVal": "标志值（内部用途）",
        "city": "用户所在城市",
        "country": "用户所在国家",
        "description": "个性签名",
        "encryptUserName": "加密后的用户名",
        "hasWeiXinHdHeadImg": "是否有高清头像（1=有，0=无）",
        "imgBuf": {
            "buffer": "头像 buffer（一般为空）",
            "iLen": "头像 buffer 长度"
        },
        "imgFlag": "头像标志",
        "labelIdlist": "标签 ID 列表",
        "nickName": {
            "String": "用户昵称"
        },
        "phoneNumListInfo": {
            "count": "绑定的手机号数量"
        },
        "province": "省份",
        "pyinitial": {
            "String": "昵称拼音首字母"
        },
        "quanPin": {
            "String": "昵称全拼"
        },
        "remark": {
            "String": "备注名"
        },
        "remarkPyinitial": {
            "String": "备注名拼音首字母"
        },
        "remarkQuanPin": {
            "String": "备注名全拼"
        },
        "sex": "性别（1=男，2=女，0=未知）",
        "smallHeadImgUrl": "用户头像小图 URL",
        "snsUserInfo": {
            "snsFlag": "朋友圈标志位（1=可见）"
        },
        "textStatusFlag": "状态标志（内部用途）",
        "userName": {
            "String": "用户的 wxid"
        },
        "verifyFlag": "认证标志（大 V 等）"
    },
    "status": "消息状态（3=已送达 等）",
    "toUserName": {
        "String": "接收者 wxid（通常是自己）"
    }
}
```

### 朋友圈消息回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- RespRef: `R3`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194231e0

cURL:
```bash
curl --location --request PUT '主动推送的'
```

### 聊天对象切换回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194249e0

cURL:
```bash
curl --location --request PUT '窗口切换事件回调'
```

Response example:
```json
{
    "account_wxid": "本人wxid",
    "event_desc": "打开聊天窗口",
    "event_type": 1005,
    "http_port": 19088,
    "hwnd": 0,
    "new_wxid": "切换到哪个wxid",
    "pid": 4484,
    "user_profile": {
        "addContactScene": 0,
        "additionalContactList": {
            "linkedinContactItem": {}
        },
        "albumFlag": 0,
        "albumStyle": 0,
        "alias": "yukai990309",
        "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/Bibic2RegnVoj0ataBRxz2N0JIezBoO7s7Y9WPB3DVniboTQcfNKlhfkVqt1OPymgDPwEn4odlKqVOdHBtKXhxIR6oOFZvFOjT0WzmWyaTDDDsBeHtmT5NpsWc1d4cvh7m5/0",
        "bitMask": 4294967295,
        "bitMask2": "18446744073709551615",
        "bitVal": 3,
        "bitValue2": "256",
        "chatRoomBusinessType": "0",
        "chatRoomNotify": 0,
        "chatroomAccessType": 0,
        "chatroomInfoVersion": 0,
        "chatroomMaxCount": 0,
        "chatroomStatus": 0,
        "chatroomVersion": 0,
        "contactExtraInfoBuf": {
            "iLen": 0
        },
        "contactType": 0,
        "customizedInfo": {
            "brandFlag": 0
        },
        "deleteContactScene": 0,
        "deleteFlag": 0,
        "domainList": {},
        "encryptUserName": "v3_020b3826fd030100000000002841186dfe858e000000501ea9a3dba12f95f6b60a0536a1adb6b42927056065fce45dd36cbd2b1e3c5ffb978746ba65481041d9396f26abbd5675d1b537dd231e59d2259453fbd9215fd6239d922fbc0189944fc25f2e@stranger",
        "eraseChatRoomMemberData": 0,
        "extFlag": 0,
        "friendUserName": "wxid_rtsk9o5r0e6622",
        "hasWeiXinHdHeadImg": 1,
        "headImgMd5": "2eaf29e93c7dcf7daae94fbe144db05a",
        "imgBuf": {
            "iLen": 0
        },
        "imgFlag": 3,
        "isInChatRoom": 0,
        "level": 0,
        "myBrandList": "<brandlist></brandlist>",
        "newChatroomData": {
            "chatRoomUserName": {},
            "infoMask": 0,
            "memberCount": 0,
            "watchMemberCount": 0
        },
        "nickName": {
            "String": "玖"
        },
        "personalCard": 0,
        "phoneNumListInfo": {
            "count": 0
        },
        "pyinitial": {
            "String": "J"
        },
        "quanPin": {
            "String": "jiu"
        },
        "remark": {},
        "remarkPyinitial": {},
        "remarkQuanPin": {},
        "ringBackSetting": {
            "endTs": 0,
            "finderObjectId": "0",
            "startTs": 0
        },
        "roomInfoCount": 0,
        "sex": 0,
        "signature": "房东直租 没有任何中间费用",
        "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/Bibic2RegnVoj0ataBRxz2N0JIezBoO7s7Y9WPB3DVniboTQcfNKlhfkVqt1OPymgDPwEn4odlKqVOdHBtKXhxIR6oOFZvFOjT0WzmWyaTDDDsBeHtmT5NpsWc1d4cvh7m5/132",
        "snsUserInfo": {
            "snsBgimgId": "http://shmmsns.qpic.cn/mmsns/o3ZC0shIPBvXsJfwdAzx1DRa6QrWjXPanmDwesoQiazUBgmXjX7PDQFibhczUAlMLanfsXUhLtztg/0",
            "snsBgobjectId": "14678939430881923677",
            "snsFlag": 1,
            "snsFlagEx": 128,
            "snsPrivacyRecent": 0
        },
        "source": 3,
        "textStatusFlag": 2,
        "userName": {
            "String": "wxid_rtsk9o5r0e6622"
        },
        "verifyFlag": 0,
        "weiboFlag": 0
    }
}
```

### 群成员修改昵称回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194250e0

cURL:
```bash
curl --location --request PUT '群成员修改昵称事件'
```

Response example:
```json
{
    "account_wxid": "wxid_8543785438012",
    "data": {
        "createtime": 1761110902,
        "membercount": 1,
        "memberlist": {
            "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/pibn7BQRp9ic1332NlNhsh9vnuCsUicOIeex3UWGqSDqkdooDuIIg82JbEicplak8b3FEGh08W7icuMoCicrbVba1oMAamibZzXcNVTWDPhejEscGyn5BehDcomDqBk3W6ax5Xy/0",
            "chatroomMemberFlag": 8,
            "displayName": "在干嘛",
            "nickName": "隔壁老陈",
            "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/pibn7BQRp9ic1332NlNhsh9vnuCsUicOIeex3UWGqSDqkdooDuIIg82JbEicplak8b3FEGh08W7icuMoCicrbVba1oMAamibZzXcNVTWDPhejEscGyn5BehDcomDqBk3W6ax5Xy/132",
            "status": 0,
            "userName": "wxid_ozyqateb85un22"
        },
        "roomid": "49767299448@chatroom",
        "roomname": "666666666666"
    },
    "event_desc": "群员昵称修改通知",
    "event_type": 1012,
    "http_port": 19088,
    "hwnd": 0,
    "pid": 4484
}
```

### 群成员进群回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194251e0

cURL:
```bash
curl --location --request PUT '群成员进群回调'
```

Response example:
```json
{
    "account_wxid": "当前登录账号ID",
    "data": {
        "createtime": "事件创建时间",
        "membercount": "群成员数量",
        "memberlist": {
            "addChatRoomSceneNewXml": "添加群成员场景XML",
            "bigHeadImgUrl": "大头像URL",
            "chatroomMemberFlag": "群成员标志",
            "inviterUserName": "邀请者用户名",
            "nickName": "昵称",
            "smallHeadImgUrl": "小头像URL",
            "status": "状态",
            "userName": "用户名"
        },
        "roomid": "群ID",
        "roomname": "群名称"
    },
    "event_desc": "事件描述",
    "event_type": "事件类型",
    "http_port": "HTTP服务端口",
    "hwnd": "窗口句柄",
    "pid": "进程ID"
}
```

### 群成员退群回调
- Method: `PUT`
- URL: N/A
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194252e0

cURL:
```bash
curl --location --request PUT '群成员退群回调'
```

Response example:
```json
{
    "account_wxid": "当前登录账号ID",
    "data": {
        "createtime": "事件创建时间",
        "membercount": "群成员数量", 
        "memberlist": {
            "addChatRoomSceneNewXml": "群成员场景XML",
            "bigHeadImgUrl": "大头像URL",
            "chatroomMemberFlag": "群成员标志",
            "inviterUserName": "邀请者用户名",
            "nickName": "昵称",
            "smallHeadImgUrl": "小头像URL",
            "status": "状态",
            "userName": "用户名"
        },
        "roomid": "群ID",
        "roomname": "群名称"
    },
    "event_desc": "事件描述",
    "event_type": "事件类型",
    "http_port": "HTTP服务端口",
    "hwnd": "窗口句柄",
    "pid": "进程ID"
}
```

## ??

### 获取好友二维码
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_my_qrocde`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194183e0

Request example:
```json
{"wxid":"45220347292@chatroom","opcode":"0","style":"7","info":"说明1-8 style都是风格 你们可以自己看看"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_my_qrocde' 
--header 'Content-Type: application/json' 
--data-raw '{"wxid":"45220347292@chatroom","opcode":"0","style":"7","info":"说明1-8 style都是风格 你们可以自己看看"}'
```

Response example:
```json
{
    "baseResponse": {
        "ret": -2,
        "errMsg": {}
    },
    "qrcode": {
        "iLen": 0
    },
    "style": 0,
    "dominatorColorSize": 0
}
```

### 修改自己昵称
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/mod_self_nick_name`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194192e0

Request example:
```json
{
    "newName": "鸭梨🍐大a"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/mod_self_nick_name' 
--header 'Content-Type: application/json' 
--data-raw '{
    "newName": "鸭梨🍐大a"
}'
```

Response example:
```json
{
    "ret": 0,
    "oplogRet": {
        "count": 1,
        "ret": [
            0
        ],
        "errMsg": [
            {}
        ]
    }
}
```

### 获取好友列表
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_frien_lists`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194198e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_frien_lists'
```

Response example:
```json
{
    "data": [
        {
            "contact": {
                "alias": "",
                "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/JHHDzT07V5jP78o6NSXyMUd8ZbgJG4wH5nx44Rq1vftIUXmSFDtiasicJ18rXN3MU980bLMQ48f9IUnCXPia4W7KQ/0",
                "bitMask": 4294967295,
                "bitVal": 1,
                "city": "",
                "country": "",
                "encryptUserName": "v3_020b3826fd0301000000000034bc2a9383cc9c000000501ea9a3dba12f95f6b60a0536a1adb6f580631340234a6fd1c318fd0e1424ea5070b3d30d80aa895e783f48f451d0cf5e2aa4f8cd7d29d450c977f9@stranger",
                "hasWeiXinHdHeadImg": 1,
                "imgBuf": {
                    "buffer": "",
                    "iLen": 0
                },
                "imgFlag": 2,
                "nickName": {
                    "String": "语音记事本"
                },
                "province": "",
                "pyinitial": {
                    "String": "YYJSB"
                },
                "quanPin": {
                    "String": "yuyinjishiben"
                },
                "remark": {
                    "String": ""
                },
                "remarkPyinitial": {
                    "String": ""
                },
                "remarkQuanPin": {
                    "String": ""
                },
                "sex": 0,
                "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/ver_1/JHHDzT07V5jP78o6NSXyMUd8ZbgJG4wH5nx44Rq1vftIUXmSFDtiasicJ18rXN3MU980bLMQ48f9IUnCXPia4W7KQ/132",
                "snsUserInfo": {
                    "snsFlag": 0
                },
                "textStatusFlag": 2,
                "userName": {
                    "String": "medianote"
                },
                "verifyFlag": 0
            },
            "ret": 0,
            "username": "medianote"
        },
        {
            "contact": {
                "alias": "",
                "bigHeadImgUrl": "https://wx.qlogo.cn/mmhead/Q3auHgzwzM6H8bJKHKyGY2mk0ljLfodkWnrRbXLn3P11f68cg0ePxA/0",
                "bitMask": 4294967295,
                "bitVal": 1,
                "city": "",
                "country": "",
                "customizedInfo": {
                    "brandFlag": 0,
                    "brandIconUrl": "http://mmbiz.qpic.cn/mmbiz_png/aOncaiaP23TAocUWWAAXgfmq5oZq5Qz9tFXIsMEnnkk2JtRWlfnh34oMUJ72s0KcfHhGIM7mwXVpslXoBnWWKkg/0?wx_fmt=png",
                    "externalInfo": "{"IsShowHeadImgInMsg":"1","IsHideInputToolbarInMsg":"0","IsAgreeProtocol":"1","RoleId":"1","InteractiveMode":"2","VerifySource":{"Description":"深圳市腾讯计算机系统有限公司","IntroUrl":"http://mp.weixin.qq.com/mp/getverifyinfo?__biz=MTAwMDA1#wechat_webview_type=1&wechat_redirect","Type":0,"VerifyBizType":1,"VerifyCustomerType":1},"MMBizMenu":{"uin":100005,"interactive_mode":2,"update_time":1664970762,"button_list":[{"id":3574535416,"type":0,"name":"自助工具","key":"rselfmenu_0","value":"","sub_button_list":[{"id":3574535416,"type":2,"name":"忘记密码","key":"rselfmenu_0_0","value":"https://support.weixin.qq.com/getpassword?lang=zh_CN&pass_ticket=6Uo%2F3ydY35gDBzZI1ZKLPHIx3qEwkQDTHD55hScdu7U%3D","sub_button_list":[],"native_url":""},{"id":3574535416,"type":2,"name":"冻结帐号","key":"rselfmenu_0_1","value":"https://weixin110.qq.com/freeze","sub_button_list":[],"native_url":""},{"id":3574535416,"type":2,"name":"解冻帐号","key":"rselfmenu_0_2","value":"https://weixin110.qq.com/unfreeze","sub_button_list":[],"native_url":""},{"id":3574535416,"type":2,"name":"注册辅助验证","key":"rselfmenu_0_3","value":"https://weixin110.qq.com/security/readtemplate?t=signup_verify/w_wxteam_help","sub_button_list":[],"native_url":""},{"id":3574535416,"type":2,"name":"解封/申诉辅助验证","key":"rselfmenu_0_4","value":"https://weixin110.qq.com/security/readtemplate?t=w_security_center_website/w_friend_help_request","sub_button_list":[],"native_url":""}],"native_url":""},{"id":3574535416,"type":2,"name":"帮助与反馈","key":"rselfmenu_1","value":"https://kf.qq.com/cgi-bin/commh5jumpwx?jumpurl=https%3A%2F%2Fkf.qq.com%2Ftouch%2Fwechat-product%2Findex.html?scene=wxhelp","sub_button_list":[],"native_url":""}],"version":3574535416},"ScanQRCodeType":1,"ServiceType":1,"RegisterSource":{"RegisterBody":"深圳市腾讯计算机系统有限公司","IntroUrl":"http://mp.weixin.qq.com/mp/getverifyinfo?__biz=MTAwMDA1&type=reg_info#wechat_redirect","AboutBizUrl":"http://mp.weixin.qq.com/mp/aboutbiz?__biz=MTAwMDA1#wechat_redirect"},"Appid":"wx10583a7e974992ec"}"
                },
                "encryptUserName": "v3_020b3826fd03010000000000b7701a593e1b44000000501ea9a3dba12f95f6b60a0536a1adb6f580631340234a6fd1c318fdfad7660e940b41264abd9a3f4611c599796b646b66f6db50fb4b52b9312bc300@stranger",
                "hasWeiXinHdHeadImg": 1,
                "imgBuf": {
                    "buffer": "",
                    "iLen": 0
                },
                "imgFlag": 2,
                "nickName": {
                    "String": "微信团队"
                },
                "province": "",
                "pyinitial": {
                    "String": "WXTD"
                },
                "quanPin": {
                    "String": "weixintuandui"
                },
                "remark": {
                    "String": ""
                },
                "remarkPyinitial": {
                    "String": ""
                },
                "remarkQuanPin": {
                    "String": ""
                },
                "sex": 0,
                "smallHeadImgUrl": "https://wx.qlogo.cn/mmhead/Q3auHgzwzM6H8bJKHKyGY2mk0ljLfodkWnrRbXLn3P11f68cg0ePxA/132",
                "snsUserInfo": {
                    "snsFlag": 0
                },
                "textStatusFlag": 2,
                "userName": {
                    "String": "weixin"
                },
                "verifyFlag": 56
            },
            "ret": 0,
            "username": "weixin"
        }
    ],
    "friend_count": 147
}
```

### 确认收款
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/ten_pay_trans_fer_confirm`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194211e0

Request example:
```json
{
    "invalid_time": 0,
    "transferid": "string"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/ten_pay_trans_fer_confirm' 
--header 'Content-Type: application/json' 
--data-raw '{
    "invalid_time": 0,
    "transferid": "string"
}'
```

### 拒绝收款
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/un_ten_pay_trans_fer_confirm`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194212e0

Request example:
```json
{
    "invalid_time": 0,
    "transferid": "string"
}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/un_ten_pay_trans_fer_confirm' 
--header 'Content-Type: application/json' 
--data-raw '{
    "invalid_time": 0,
    "transferid": "string"
}'
```

### 修改头像
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/upload_head_img`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194229e0

Request example:
```json
{"filepath":"D:\2.png"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/upload_head_img' 
--header 'Content-Type: application/json' 
--data-raw '{"filepath":"D:\2.png"}'
```

### 修改个人签名
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/mod_self_nick_signature`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194230e0

Request example:
```json
{"newSignature":"666666666666666"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/mod_self_nick_signature' 
--header 'Content-Type: application/json' 
--data-raw '{"newSignature":"666666666666666"}'
```

### 获取群员昵称
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_group_memeber_info`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194244e0

Request example:
```json
{"roomId":"49767299448@chatroom","memeberId":"wxid_bktzp6cv7wxe12"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_group_memeber_info' 
--header 'Content-Type: application/json' 
--data-raw '{"roomId":"49767299448@chatroom","memeberId":"wxid_bktzp6cv7wxe12"}'
```

### 二维码识别
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/qrscan`
- Content-Type: `application/json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194257e0

Request example:
```json
{"path":"d:\qr2.png"}
```

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/qrscan' 
--header 'Content-Type: application/json' 
--data-raw '{"path":"d:\qr2.png"}'
```

Response example:
```json
{
    "account_wxid": "",
    "data": {
        "scan_res": "woaini"
    },
    "errCode": 1,
    "errMsg": "请求处理成功"
}
```

### 获取收藏列表
- Method: `POST`
- URL: `http://127.0.0.1:19088/api/get_favs`
- Content-Type: `json`
- Share: https://s.apifox.cn/1d27f9da-72ec-4981-ae95-deb20a0c1412/410194270e0

cURL:
```bash
curl --location --request POST 'http://127.0.0.1:19088/api/get_favs'
```

