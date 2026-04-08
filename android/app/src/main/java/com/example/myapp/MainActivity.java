package com.example.myapp;

import android.os.Bundle;
import android.view.WindowManager;
import android.app.PictureInPictureParams;
import android.util.Rational;
import android.os.Build;
import android.content.res.Configuration;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Разблокировка 120 Гц экрана
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
    }

    // 1. Вызывается, когда пользователь нажимает кнопку "Домой" или сворачивает приложение
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Включаем "Картинка в картинке", делаем окно идеально квадратным (1:1)
            PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder();
            pipBuilder.setAspectRatio(new Rational(1, 1));
            enterPictureInPictureMode(pipBuilder.build());
        }
    }

    // 2. Отслеживаем вход/выход из режима и передаем команду в твой CSS!
    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            if (isInPictureInPictureMode) {
                // Если свернули - добавляем класс 'is-pip' к <body>
                this.bridge.getWebView().evaluateJavascript("document.body.classList.add('is-pip');", null);
            } else {
                // Если развернули обратно - убираем класс
                this.bridge.getWebView().evaluateJavascript("document.body.classList.remove('is-pip');", null);
            }
        }
    }
}
