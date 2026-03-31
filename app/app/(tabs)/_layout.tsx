import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { THEME } from '../../lib/theme';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME.tabActive,
        tabBarInactiveTintColor: THEME.tabInactive,
        tabBarStyle: {
          backgroundColor: THEME.tabBar,
          borderTopColor: 'rgba(255,255,255,0.05)',
          paddingBottom: 4,
          height: 88,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: THEME.bg,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: THEME.textPrimary,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
