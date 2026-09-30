import React, { useState } from 'react';
import { Badge, Dropdown, Button, List, Empty } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/hooks/useNotifications';
import './index.less';

const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    signalRConnected, 
    handleMarkAllRead, 
    handleMarkSingleRead 
  } = useNotifications();

  const handleMenuClick = (e: any) => {
    e.stopPropagation();
  };

  const handleNotificationClick = async (notificationId: string) => {
    await handleMarkSingleRead(Number(notificationId));
  };

  const menu = (
    <div className="notification-dropdown" onClick={handleMenuClick}>
      <div className="notification-header">
        <div className="notification-title">
          {t('notifications.titleWithUnreadCount', { count: unreadCount })}
        </div>
        <div className="notification-status">
          <span className={`connection-status ${signalRConnected ? 'connected' : 'disconnected'}`}>
            {signalRConnected
              ? `● ${t('notifications.connected')}`
              : `● ${t('notifications.disconnected')}`}
          </span>
        </div>
      </div>
      
      <div className="notification-content">
        {notifications.length === 0 ? (
          <Empty 
            description={t('notifications.noNotifications')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '20px' }}
          />
        ) : (
          <List
            dataSource={notifications.slice(0, 10)}
            renderItem={(item) => (
              <List.Item
                className={`notification-item ${item.isRead ? 'read' : 'unread'}`}
                onClick={() => handleNotificationClick(item.id)}
              >
                <div className="notification-item-content">
                  <div className="notification-item-title">{item.title}</div>
                  <div className="notification-item-message">{item.content}</div>
                  <div className="notification-item-time">{item.time}</div>
                </div>
                {!item.isRead && <div className="unread-indicator" />}
              </List.Item>
            )}
          />
        )}
      </div>
      
      {notifications.length > 0 && (
        <div className="notification-footer">
          <Button 
            type="link" 
            size="small" 
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            {t('notifications.markAllAsRead')}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      overlay={menu}
      trigger={['click']}
      visible={visible}
      onVisibleChange={setVisible}
      placement="bottomRight"
      overlayClassName="notification-dropdown-overlay"
    >
      <Badge count={unreadCount} size="small">
        <Button
          type="text"
          icon={<BellOutlined />}
          className="notification-bell"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
