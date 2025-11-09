#include "MainWindow.h"
#include <QWebEngineView>
#include <QWebEnginePage>
#include <QWebEngineHistory>
#include <QWebEngineProfile>
#include <QLineEdit>
#include <QPushButton>
#include <QToolBar>
#include <QVBoxLayout>
#include "WebEnginePage.h" // Include the custom page

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    // Create the web view and set the custom page
    m_view = new QWebEngineView(this);
    m_view->setPage(new WebEnginePage(this));
    setCentralWidget(m_view);

    // Ad-Blocker Setup
    m_adBlocker = new AdBlocker(this);
    m_adBlocker->loadBlocklistFromFile("blocklist.txt");
    m_requestHandler = new RequestHandler(m_adBlocker, this);
    m_view->page()->profile()->setUrlRequestInterceptor(m_requestHandler);

    // Create the toolbar and UI controls
    QToolBar *toolBar = new QToolBar(this);
    addToolBar(toolBar);

    m_backButton = new QPushButton("<-", this);
    m_forwardButton = new QPushButton("->", this);
    m_reloadButton = new QPushButton("Reload", this);
    m_addressBar = new QLineEdit(this);

    toolBar->addWidget(m_backButton);
    toolBar->addWidget(m_forwardButton);
    toolBar->addWidget(m_reloadButton);
    toolBar->addWidget(m_addressBar);

    // Connect signals and slots
    connect(m_backButton, &QPushButton::clicked, this, &MainWindow::goBack);
    connect(m_forwardButton, &QPushButton::clicked, this, &MainWindow::goForward);
    connect(m_reloadButton, &QPushButton::clicked, this, &MainWindow::reload);
    connect(m_addressBar, &QLineEdit::returnPressed, this, &MainWindow::navigate);
    connect(m_view, &QWebEngineView::urlChanged, this, &MainWindow::updateAddressBar);
    connect(m_view, &QWebEngineView::loadFinished, this, &MainWindow::updateNavigationButtons);

    // Set initial state
    m_view->setUrl(QUrl("https://www.google.com"));
    updateNavigationButtons();
}

MainWindow::~MainWindow()
{
}

void MainWindow::goBack()
{
    m_view->back();
}

void MainWindow::goForward()
{
    m_view->forward();
}

void MainWindow::reload()
{
    m_view->reload();
}

void MainWindow::navigate()
{
    QString url = m_addressBar->text();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
    }
    m_view->setUrl(QUrl(url));
}

void MainWindow::updateNavigationButtons()
{
    m_backButton->setEnabled(m_view->page()->history()->canGoBack());
    m_forwardButton->setEnabled(m_view->page()->history()->canGoForward());
}

void MainWindow::updateAddressBar(const QUrl &url)
{
    m_addressBar->setText(url.toString());
}
