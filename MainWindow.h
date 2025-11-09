#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include "AdBlocker.h"
#include "RequestHandler.h"

class QWebEngineView;
class QLineEdit;
class QPushButton;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void goBack();
    void goForward();
    void reload();
    void navigate();
    void updateNavigationButtons();
    void updateAddressBar(const QUrl &url);

private:
    QWebEngineView *m_view;
    QLineEdit *m_addressBar;
    QPushButton *m_backButton;
    QPushButton *m_forwardButton;
    QPushButton *m_reloadButton;

    AdBlocker *m_adBlocker;
    RequestHandler *m_requestHandler;
};

#endif // MAINWINDOW_H
